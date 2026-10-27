import { hasSmsPermission, type NormalizedInboxSms } from '../native/SmsModule';
import type { IngestSmsOptions, RawSmsPayload } from '../ingest';
import { collectBankSenderSms } from './bankSenderScan';

/** Overlap before last checkpoint — protects race/boundary SMS. */
export const INCREMENTAL_OVERLAP_MS = 5 * 60 * 1000;

/** First-time / no-checkpoint lookback (NOT full historical 30d). */
export const INCREMENTAL_INITIAL_LOOKBACK_MS = 24 * 60 * 60 * 1000;

/** Page size only — never a total sync cap. */
export const INCREMENTAL_PAGE_SIZE = 200;

export type IncrementalSyncStatus = 'idle' | 'scanning' | 'completed' | 'error' | 'skipped';

export type IncrementalSyncResult = {
  mode: 'incremental';
  status: IncrementalSyncStatus;
  scannedCount: number;
  createdCount: number;
  updatedCount: number;
  duplicateCount: number;
  reviewCount: number;
  unknownCount: number;
  ignoredCount: number;
  nonTransactionalCount: number;
  rangeStart: number;
  rangeEnd: number;
  completedAt: string;
  checkpointAdvanced: boolean;
  perSenderCounts?: Record<string, number>;
  error?: string;
  skipReason?: 'permission' | 'disabled' | 'not_android' | 'busy_joined';
  newestSmsDate?: number;
  newestSmsId?: string;
};

export type IncrementalCheckpoint = {
  lastSuccessfulSmsSyncAt?: string;
  lastSuccessfulSmsSyncSmsDate?: number;
  lastSuccessfulSmsSyncSmsId?: string;
  lastImportedTimestamp?: number;
  lastHistoricalImportAt?: string;
};

export type IncrementalIngestFn = (
  payload: RawSmsPayload,
  options?: IngestSmsOptions,
) => { kind: string };

export type IncrementalSyncInput = {
  checkpoint: IncrementalCheckpoint;
  smsProcessingEnabled: boolean;
  ingest: IncrementalIngestFn;
  /** User-verified senders — REQUIRED for production scans */
  verifiedSenders: string[];
  overlapMs?: number;
  initialLookbackMs?: number;
  pageSize?: number;
  nowMs?: number;
  hasPermission?: () => Promise<boolean>;
  collectRows?: (range: {
    minDateMs: number;
    maxDateMs: number;
  }) => Promise<{ rows: NormalizedInboxSms[]; perSenderCounts: Record<string, number> }>;
  /** @deprecated test helper — wraps into collectRows */
  readBatch?: (input: {
    minDateMs: number;
    maxDateMs: number;
    offset: number;
    limit: number;
  }) => Promise<NormalizedInboxSms[]>;
  onProgress?: (partial: Partial<IncrementalSyncResult> & { status: IncrementalSyncStatus }) => void;
};

let inFlight: Promise<IncrementalSyncResult> | null = null;

export function isIncrementalSyncRunning(): boolean {
  return inFlight != null;
}

export function resolveIncrementalRange(input: {
  checkpoint: IncrementalCheckpoint;
  nowMs: number;
  overlapMs?: number;
  initialLookbackMs?: number;
}): { rangeStart: number; rangeEnd: number } {
  const overlap = input.overlapMs ?? INCREMENTAL_OVERLAP_MS;
  const lookback = input.initialLookbackMs ?? INCREMENTAL_INITIAL_LOOKBACK_MS;
  const rangeEnd = input.nowMs;

  let anchorMs: number | undefined;
  if (input.checkpoint.lastSuccessfulSmsSyncAt) {
    const parsed = Date.parse(input.checkpoint.lastSuccessfulSmsSyncAt);
    if (!Number.isNaN(parsed)) {
      anchorMs = parsed;
    }
  }
  if (anchorMs == null && input.checkpoint.lastSuccessfulSmsSyncSmsDate != null) {
    anchorMs = input.checkpoint.lastSuccessfulSmsSyncSmsDate;
  }
  if (anchorMs == null && input.checkpoint.lastImportedTimestamp != null) {
    anchorMs = input.checkpoint.lastImportedTimestamp;
  }
  if (anchorMs == null && input.checkpoint.lastHistoricalImportAt) {
    const parsed = Date.parse(input.checkpoint.lastHistoricalImportAt);
    if (!Number.isNaN(parsed)) {
      anchorMs = parsed;
    }
  }

  const rangeStart =
    anchorMs != null ? Math.max(0, anchorMs - overlap) : Math.max(0, rangeEnd - lookback);

  return { rangeStart, rangeEnd };
}

/**
 * Sender-based incremental SMS sync.
 * Queries known bank senders directly — no body keyword filter, no total 500/5000 cap.
 * Checkpoint advances ONLY when the full range completes successfully.
 */
export async function runIncrementalSmsSync(
  input: IncrementalSyncInput,
): Promise<IncrementalSyncResult> {
  if (inFlight) {
    const joined = await inFlight;
    return { ...joined, skipReason: 'busy_joined' };
  }

  inFlight = executeIncrementalSmsSync(input).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export function __resetIncrementalSyncLockForTests(): void {
  inFlight = null;
}

async function executeIncrementalSmsSync(
  input: IncrementalSyncInput,
): Promise<IncrementalSyncResult> {
  const nowMs = input.nowMs ?? Date.now();
  const pageSize = input.pageSize ?? INCREMENTAL_PAGE_SIZE;
  const { rangeStart, rangeEnd } = resolveIncrementalRange({
    checkpoint: input.checkpoint,
    nowMs,
    overlapMs: input.overlapMs,
    initialLookbackMs: input.initialLookbackMs,
  });

  const base: IncrementalSyncResult = {
    mode: 'incremental',
    status: 'idle',
    scannedCount: 0,
    createdCount: 0,
    updatedCount: 0,
    duplicateCount: 0,
    reviewCount: 0,
    unknownCount: 0,
    ignoredCount: 0,
    nonTransactionalCount: 0,
    rangeStart,
    rangeEnd,
    completedAt: new Date(nowMs).toISOString(),
    checkpointAdvanced: false,
  };

  const emit = (partial: Partial<IncrementalSyncResult> & { status: IncrementalSyncStatus }) => {
    input.onProgress?.(partial);
  };

  if (!input.smsProcessingEnabled) {
    const skipped = { ...base, status: 'skipped' as const, skipReason: 'disabled' as const };
    emit(skipped);
    return skipped;
  }

  const permissionOk = input.hasPermission
    ? await input.hasPermission()
    : await hasSmsPermission();
  if (!permissionOk) {
    const skipped = { ...base, status: 'skipped' as const, skipReason: 'permission' as const };
    emit(skipped);
    return skipped;
  }

  const verifiedSenders = input.verifiedSenders ?? [];
  if (verifiedSenders.length === 0) {
    const doneEmpty: IncrementalSyncResult = {
      ...base,
      status: 'completed',
      checkpointAdvanced: true,
      completedAt: new Date().toISOString(),
    };
    emit(doneEmpty);
    return doneEmpty;
  }

  emit({ ...base, status: 'scanning' });

  let rows: NormalizedInboxSms[] = [];
  let perSenderCounts: Record<string, number> = {};

  try {
    if (input.collectRows) {
      const collected = await input.collectRows({ minDateMs: rangeStart, maxDateMs: rangeEnd });
      rows = collected.rows;
      perSenderCounts = collected.perSenderCounts;
    } else if (input.readBatch) {
      let offset = 0;
      while (true) {
        const page = await input.readBatch({
          minDateMs: rangeStart,
          maxDateMs: rangeEnd,
          offset,
          limit: pageSize,
        });
        if (page.length === 0) {
          break;
        }
        rows.push(...page);
        offset += page.length;
        if (page.length < pageSize) {
          break;
        }
      }
      perSenderCounts = { test: rows.length };
    } else {
      const collected = await collectBankSenderSms({
        minDateMs: rangeStart,
        maxDateMs: rangeEnd,
        senders: verifiedSenders,
        pageSize,
      });
      rows = collected.rows;
      perSenderCounts = collected.perSenderCounts;
    }
  } catch (e) {
    const err = {
      ...base,
      status: 'error' as const,
      checkpointAdvanced: false,
      error: e instanceof Error ? e.message : 'inbox_read_failed',
      completedAt: new Date().toISOString(),
    };
    emit(err);
    return err;
  }

  let scannedCount = 0;
  let createdCount = 0;
  let updatedCount = 0;
  let duplicateCount = 0;
  let reviewCount = 0;
  let unknownCount = 0;
  let ignoredCount = 0;
  let nonTransactionalCount = 0;
  let newestSmsDate: number | undefined;
  let newestSmsId: string | undefined;

  try {
    for (const row of rows) {
      scannedCount += 1;
      const ts = Date.parse(row.receivedAt);
      if (!Number.isNaN(ts)) {
        if (newestSmsDate == null || ts > newestSmsDate) {
          newestSmsDate = ts;
          newestSmsId = row.sourceSmsId;
        }
      }

      const result = input.ingest(
        {
          sender: row.sender,
          body: row.body,
          receivedAt: row.receivedAt,
          sourceSmsId: row.sourceSmsId,
        },
        { mode: 'incremental' },
      );

      switch (result.kind) {
        case 'created':
        case 'merged':
          createdCount += 1;
          break;
        case 'updated':
          updatedCount += 1;
          break;
        case 'duplicate':
          duplicateCount += 1;
          break;
        case 'review':
        case 'pending':
          reviewCount += 1;
          break;
        case 'unknown':
          unknownCount += 1;
          break;
        case 'non_transactional':
          nonTransactionalCount += 1;
          break;
        case 'ignored':
          ignoredCount += 1;
          break;
        default:
          break;
      }

      // Keep UI responsive without per-SMS overhead
      if (scannedCount % 75 === 0) {
        await new Promise<void>(resolve => setTimeout(resolve, 0));
      }
    }
  } catch (e) {
    const err: IncrementalSyncResult = {
      ...base,
      status: 'error',
      scannedCount,
      createdCount,
      updatedCount,
      duplicateCount,
      reviewCount,
      unknownCount,
      ignoredCount,
      nonTransactionalCount,
      perSenderCounts,
      checkpointAdvanced: false,
      error: e instanceof Error ? e.message : 'sync_failed',
      completedAt: new Date().toISOString(),
    };
    emit(err);
    return err;
  }

  const done: IncrementalSyncResult = {
    mode: 'incremental',
    status: 'completed',
    scannedCount,
    createdCount,
    updatedCount,
    duplicateCount,
    reviewCount,
    unknownCount,
    ignoredCount,
    nonTransactionalCount,
    rangeStart,
    rangeEnd,
    completedAt: new Date().toISOString(),
    checkpointAdvanced: true,
    perSenderCounts,
    newestSmsDate,
    newestSmsId,
  };
  emit(done);
  return done;
}

export type IncrementalCheckpointPatch = {
  lastSuccessfulSmsSyncAt: string;
  lastSuccessfulSmsSyncSmsDate?: number;
  lastSuccessfulSmsSyncSmsId?: string;
  smsLastInboxAt: string;
};

export function checkpointPatchFromResult(
  result: IncrementalSyncResult,
): IncrementalCheckpointPatch | null {
  if (result.status !== 'completed' || !result.checkpointAdvanced) {
    return null;
  }
  return {
    lastSuccessfulSmsSyncAt: new Date(result.rangeEnd).toISOString(),
    lastSuccessfulSmsSyncSmsDate: result.newestSmsDate,
    lastSuccessfulSmsSyncSmsId: result.newestSmsId,
    smsLastInboxAt: new Date(result.rangeEnd).toISOString(),
  };
}
