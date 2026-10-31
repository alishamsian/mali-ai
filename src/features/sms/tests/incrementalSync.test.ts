import {
  __resetIncrementalSyncLockForTests,
  checkpointPatchFromResult,
  INCREMENTAL_OVERLAP_MS,
  resolveIncrementalRange,
  runIncrementalSmsSync,
} from '../import/incrementalSync';
import type { NormalizedInboxSms } from '../native/SmsModule';

function makeSms(
  id: string,
  dateMs: number,
  body = 'بانک ملت واریز مبلغ 100000 ریال مانده 1',
): NormalizedInboxSms {
  return {
    sourceSmsId: id,
    sender: '9909',
    body,
    receivedAt: new Date(dateMs).toISOString(),
  };
}

describe('incremental SMS sync', () => {
  beforeEach(() => {
    __resetIncrementalSyncLockForTests();
  });

  test('TEST 1: no previous sync checkpoint uses initial lookback', () => {
    const now = Date.parse('2026-08-27T19:00:00.000Z');
    const { rangeStart, rangeEnd } = resolveIncrementalRange({
      checkpoint: {},
      nowMs: now,
      initialLookbackMs: 24 * 60 * 60 * 1000,
    });
    expect(rangeEnd).toBe(now);
    expect(rangeStart).toBe(now - 24 * 60 * 60 * 1000);
  });

  test('TEST 2+3: previous sync + 5-minute overlap', () => {
    const now = Date.parse('2026-08-27T19:00:00.000Z');
    const last = Date.parse('2026-08-27T18:00:00.000Z');
    const { rangeStart, rangeEnd } = resolveIncrementalRange({
      checkpoint: { lastSuccessfulSmsSyncAt: new Date(last).toISOString() },
      nowMs: now,
    });
    expect(rangeEnd).toBe(now);
    expect(rangeStart).toBe(last - INCREMENTAL_OVERLAP_MS);
  });

  test('TEST 4+5: more than page size SMS are all paginated (no total cap)', async () => {
    const now = 1_000_000_000_000;
    const total = 550;
    const all: NormalizedInboxSms[] = [];
    for (let j = 0; j < total; j += 1) {
      all.push(makeSms(String(j), now - j * 1000));
    }

    let pageCalls = 0;
    const seen = new Set<string>();
    const result = await runIncrementalSmsSync({
      checkpoint: { lastSuccessfulSmsSyncAt: new Date(now - 3600_000).toISOString() },
      smsProcessingEnabled: true,
      verifiedSenders: ['9909'],
      nowMs: now,
      pageSize: 200,
      hasPermission: async () => true,
      readBatch: async ({ offset, limit }) => {
        pageCalls += 1;
        return all.slice(offset, offset + limit);
      },
      ingest: payload => {
        if (payload.sourceSmsId) {
          seen.add(payload.sourceSmsId);
        }
        return { kind: 'created' };
      },
    });

    expect(result.status).toBe('completed');
    expect(pageCalls).toBe(3);
    expect(result.scannedCount).toBe(total);
    expect(seen.size).toBe(total);
    expect(result.checkpointAdvanced).toBe(true);
  });

  test('TEST 9+13: overlapping rescans are idempotent via sourceSmsId', async () => {
    const now = Date.parse('2026-08-27T19:00:00.000Z');
    const sms = makeSms('sms-1', now - 60_000);
    const known = new Set<string>();

    const ingest = (payload: { sourceSmsId?: string }) => {
      if (payload.sourceSmsId && known.has(payload.sourceSmsId)) {
        return { kind: 'duplicate' as const };
      }
      if (payload.sourceSmsId) {
        known.add(payload.sourceSmsId);
      }
      return { kind: 'created' as const };
    };

    const readOnce = async () => [sms];

    const first = await runIncrementalSmsSync({
      checkpoint: { lastSuccessfulSmsSyncAt: new Date(now - 3600_000).toISOString() },
      smsProcessingEnabled: true,
      verifiedSenders: ['9909'],
      nowMs: now,
      hasPermission: async () => true,
      readBatch: async ({ offset }) => (offset === 0 ? readOnce() : []),
      ingest,
    });
    expect(first.createdCount).toBe(1);

    __resetIncrementalSyncLockForTests();

    const second = await runIncrementalSmsSync({
      checkpoint: { lastSuccessfulSmsSyncAt: new Date(now - 3600_000).toISOString() },
      smsProcessingEnabled: true,
      verifiedSenders: ['9909'],
      nowMs: now,
      hasPermission: async () => true,
      readBatch: async ({ offset }) => (offset === 0 ? readOnce() : []),
      ingest,
    });
    expect(second.createdCount).toBe(0);
    expect(second.duplicateCount).toBe(1);
  });

  test('TEST 10: concurrent syncs share one in-flight promise', async () => {
    const now = Date.now();
    let reads = 0;
    const slowRead = async () => {
      reads += 1;
      await new Promise<void>(r => setTimeout(r, 40));
      return [] as NormalizedInboxSms[];
    };

    const a = runIncrementalSmsSync({
      checkpoint: {},
      smsProcessingEnabled: true,
      verifiedSenders: ['9909'],
      nowMs: now,
      hasPermission: async () => true,
      readBatch: slowRead,
      ingest: () => ({ kind: 'ignored' }),
    });
    const b = runIncrementalSmsSync({
      checkpoint: {},
      smsProcessingEnabled: true,
      verifiedSenders: ['9909'],
      nowMs: now,
      hasPermission: async () => true,
      readBatch: slowRead,
      ingest: () => ({ kind: 'ignored' }),
    });

    const [ra, rb] = await Promise.all([a, b]);
    expect(reads).toBe(1);
    expect(ra.status).toBe('completed');
    expect(rb.skipReason === 'busy_joined' || rb.status === 'completed').toBe(true);
  });

  test('TEST 11+12: failed page does not advance checkpoint', async () => {
    const now = Date.now();
    let calls = 0;
    const result = await runIncrementalSmsSync({
      checkpoint: { lastSuccessfulSmsSyncAt: new Date(now - 3600_000).toISOString() },
      smsProcessingEnabled: true,
      verifiedSenders: ['9909'],
      nowMs: now,
      pageSize: 2,
      hasPermission: async () => true,
      readBatch: async () => {
        calls += 1;
        if (calls === 1) {
          return [makeSms('a', now - 10_000), makeSms('b', now - 9_000)];
        }
        throw new Error('page_fail');
      },
      ingest: () => ({ kind: 'created' }),
    });

    expect(result.status).toBe('error');
    expect(result.checkpointAdvanced).toBe(false);
    expect(checkpointPatchFromResult(result)).toBeNull();
  });

  test('TEST 14: identical bodies with different SMS ids stay separate', async () => {
    const now = Date.now();
    const body = 'بانک ملت واریز مبلغ 50000 ریال مانده 1';
    const ids: string[] = [];
    await runIncrementalSmsSync({
      checkpoint: {},
      smsProcessingEnabled: true,
      verifiedSenders: ['9909'],
      nowMs: now,
      hasPermission: async () => true,
      readBatch: async ({ offset }) =>
        offset === 0 ? [makeSms('id-1', now - 2000, body), makeSms('id-2', now - 1000, body)] : [],
      ingest: payload => {
        ids.push(payload.sourceSmsId ?? '');
        return { kind: 'created' };
      },
    });
    expect(ids).toEqual(['id-1', 'id-2']);
  });

  test('TEST 19: missing permission skips without advancing checkpoint', async () => {
    const result = await runIncrementalSmsSync({
      checkpoint: {},
      smsProcessingEnabled: true,
      verifiedSenders: ['9909'],
      hasPermission: async () => false,
      ingest: () => ({ kind: 'created' }),
    });
    expect(result.status).toBe('skipped');
    expect(result.skipReason).toBe('permission');
    expect(result.checkpointAdvanced).toBe(false);
  });

  test('TEST 20: smsProcessingEnabled=false skips', async () => {
    const result = await runIncrementalSmsSync({
      checkpoint: {},
      smsProcessingEnabled: false,
      verifiedSenders: ['9909'],
      hasPermission: async () => true,
      ingest: () => ({ kind: 'created' }),
    });
    expect(result.status).toBe('skipped');
    expect(result.skipReason).toBe('disabled');
  });

  test('TEST 17: historical baseline is used as checkpoint anchor', () => {
    const now = Date.parse('2026-08-27T19:00:00.000Z');
    const hist = Date.parse('2026-08-27T12:00:00.000Z');
    const { rangeStart } = resolveIncrementalRange({
      checkpoint: { lastImportedTimestamp: hist },
      nowMs: now,
    });
    expect(rangeStart).toBe(hist - INCREMENTAL_OVERLAP_MS);
  });

  test('successful sync produces checkpoint patch at rangeEnd', async () => {
    const now = 2_000_000_000_000;
    const result = await runIncrementalSmsSync({
      checkpoint: { lastSuccessfulSmsSyncAt: new Date(now - 60_000).toISOString() },
      smsProcessingEnabled: true,
      verifiedSenders: ['9909'],
      nowMs: now,
      hasPermission: async () => true,
      readBatch: async () => [],
      ingest: () => ({ kind: 'ignored' }),
    });
    const patch = checkpointPatchFromResult(result);
    expect(patch?.lastSuccessfulSmsSyncAt).toBe(new Date(now).toISOString());
  });
});
