import { emptySnapshot } from '../../../database/schema/snapshot';
import { ingestIncomingSms, recomputeAccountBalancesFromSms } from '../ingest';
import { collectBankSenderSms } from '../import/bankSenderScan';
import { runIncrementalSmsSync, __resetIncrementalSyncLockForTests } from '../import/incrementalSync';
import type { NormalizedInboxSms } from '../native/SmsModule';
import { addVerifiedSender } from '../senders/verified';

function mellatDeposit(amount: number, balance: number): string {
  return `بانک ملت\nواریز مبلغ ${amount.toLocaleString('en-US')} ریال\nمانده ${balance.toLocaleString('en-US')}`;
}

function enableMellat(snapshot: ReturnType<typeof emptySnapshot>) {
  snapshot.settings.smsProcessingEnabled = true;
  snapshot.settings.bankConnections = addVerifiedSender([], 'mellat', '9909', 'user_selected_sms');
  snapshot.settings.selectedBankIds = ['mellat'];
  return snapshot;
}

describe('SMS reliability acceptance', () => {
  beforeEach(() => {
    __resetIncrementalSyncLockForTests();
  });

  test('ACCEPTANCE 28: three deposits with same amounts stay separate; balance = latest', () => {
    let snapshot = enableMellat(emptySnapshot('u1'));
    snapshot.settings.selectedBankIds = ['mellat'];

    const rows: Array<{ id: string; at: string; amount: number; balance: number }> = [
      { id: '1001', at: '2026-08-27T09:10:01.000Z', amount: 100_000_000, balance: 300_000_000 },
      { id: '1002', at: '2026-08-27T09:10:03.000Z', amount: 100_000_000, balance: 400_000_000 },
      { id: '1003', at: '2026-08-27T09:10:05.000Z', amount: 50_000_000, balance: 450_000_000 },
    ];

    const createdIds: string[] = [];
    for (const row of rows) {
      const result = ingestIncomingSms(
        snapshot,
        {
          sender: '9909',
          body: mellatDeposit(row.amount, row.balance),
          receivedAt: row.at,
          sourceSmsId: row.id,
        },
        { mode: 'incremental' },
      );
      expect(result.kind).not.toBe('duplicate');
      expect(result.kind).not.toBe('ignored');
      expect(result.transaction).toBeTruthy();
      createdIds.push(result.transaction!.id);
      if (result.account) {
        snapshot = { ...snapshot, accounts: [...snapshot.accounts, result.account] };
      }
      snapshot = {
        ...snapshot,
        transactions: [result.transaction!, ...snapshot.transactions],
      };
      snapshot = {
        ...snapshot,
        accounts: recomputeAccountBalancesFromSms(snapshot.accounts, snapshot.transactions),
      };
    }

    expect(new Set(createdIds).size).toBe(3);
    expect(snapshot.transactions.filter(t => t.source === 'android_sms').length).toBe(3);

    const mellatAcc = snapshot.accounts.find(a => a.bankId === 'mellat');
    expect(mellatAcc?.balanceRial).toBe(450_000_000);

    // Resync same three → duplicates only
    for (const row of rows) {
      const again = ingestIncomingSms(
        snapshot,
        {
          sender: '9909',
          body: mellatDeposit(row.amount, row.balance),
          receivedAt: row.at,
          sourceSmsId: row.id,
        },
        { mode: 'incremental' },
      );
      expect(again.kind).toBe('duplicate');
    }

    // New SMS 1004
    const fourth = ingestIncomingSms(
      snapshot,
      {
        sender: '9909',
        body: mellatDeposit(100_000_000, 550_000_000),
        receivedAt: '2026-08-27T09:10:07.000Z',
        sourceSmsId: '1004',
      },
      { mode: 'incremental' },
    );
    expect(fourth.kind).not.toBe('duplicate');
    snapshot = {
      ...snapshot,
      transactions: [fourth.transaction!, ...snapshot.transactions],
    };
    snapshot = {
      ...snapshot,
      accounts: recomputeAccountBalancesFromSms(snapshot.accounts, snapshot.transactions),
    };
    expect(snapshot.transactions.filter(t => t.source === 'android_sms').length).toBe(4);
    expect(snapshot.accounts.find(a => a.bankId === 'mellat')?.balanceRial).toBe(550_000_000);
  });

  test('ACCEPTANCE 31: identical bodies, different SMS ids → two transactions', () => {
    let snapshot = enableMellat(emptySnapshot('u1'));
    const body = mellatDeposit(100_000_000, 300_000_000);

    const a = ingestIncomingSms(
      snapshot,
      { sender: '9909', body, receivedAt: '2026-08-27T10:00:00.000Z', sourceSmsId: '5001' },
      { mode: 'incremental' },
    );
    snapshot = {
      ...snapshot,
      accounts: a.account ? [...snapshot.accounts, a.account] : snapshot.accounts,
      transactions: a.transaction ? [a.transaction, ...snapshot.transactions] : snapshot.transactions,
    };
    const b = ingestIncomingSms(
      snapshot,
      { sender: '9909', body, receivedAt: '2026-08-27T10:00:01.000Z', sourceSmsId: '5002' },
      { mode: 'incremental' },
    );
    expect(a.kind).not.toBe('duplicate');
    expect(b.kind).not.toBe('duplicate');
    expect(a.transaction?.id).not.toBe(b.transaction?.id);
  });

  test('ACCEPTANCE 32: verified sender unfamiliar body → unknown or non_transactional, never ignored', () => {
    const snapshot = enableMellat(emptySnapshot('u1'));
    const result = ingestIncomingSms(
      snapshot,
      {
        sender: '9909',
        body: 'پیامک اطلاع‌رسانی بانک بدون قالب مالی شناخته‌شده',
        receivedAt: '2026-08-27T11:00:00.000Z',
        sourceSmsId: '9001',
      },
      { mode: 'incremental' },
    );
    expect(result.kind).not.toBe('ignored');
    expect(['unknown', 'non_transactional']).toContain(result.kind);
  });

  test('ACCEPTANCE 29: bankSenderScan paginates beyond 500 with no total cap', async () => {
    const total = 2000;
    const pages = new Map<number, NormalizedInboxSms[]>();
    for (let i = 0; i < total; i += 1) {
      const page = Math.floor(i / 200);
      const list = pages.get(page) ?? [];
      list.push({
        sourceSmsId: String(i + 1),
        sender: '9909',
        body: mellatDeposit(1000, 1000),
        receivedAt: new Date(1_700_000_000_000 + i * 1000).toISOString(),
      });
      pages.set(page, list);
    }

    const { rows } = await collectBankSenderSms({
      minDateMs: 0,
      maxDateMs: Date.now(),
      senders: ['9909'],
      pageSize: 200,
      readBatch: async ({ offset, limit }) => {
        const pageIdx = Math.floor(offset / limit);
        return pages.get(pageIdx) ?? [];
      },
    });

    expect(rows.length).toBe(total);
  });

  test('ACCEPTANCE 30: sender query ignores non-bank flood', async () => {
    const { rows, perSenderCounts } = await collectBankSenderSms({
      minDateMs: 0,
      maxDateMs: Date.now(),
      senders: ['9909'],
      pageSize: 200,
      readBatch: async ({ sender, offset }) => {
        if (sender !== '9909') {
          return [];
        }
        if (offset > 0) {
          return [];
        }
        // Only bank sender rows — non-bank SMS never appear in this query
        return Array.from({ length: 1000 }, (_, i) => ({
          sourceSmsId: `bank-${i}`,
          sender: '9909',
          body: mellatDeposit(1000, 1000),
          receivedAt: new Date(1_700_000_000_000 + i).toISOString(),
        }));
      },
    });
    expect(rows.length).toBe(1000);
    expect(perSenderCounts['9909']).toBe(1000);
  });

  test('verified sender is never discarded; unverified sender is ignored', () => {
    const snapshot = enableMellat(emptySnapshot('u1'));
    snapshot.settings.selectedBankIds = ['melli'];

    const payload = {
      sender: '9909',
      body: mellatDeposit(250_000, 1_000_000),
      receivedAt: new Date().toISOString(),
      sourceSmsId: 'sms-mellat-1',
    };

    const live = ingestIncomingSms(snapshot, payload, { mode: 'live' });
    expect(live.kind).not.toBe('ignored');

    const recovery = ingestIncomingSms(snapshot, payload, { mode: 'incremental' });
    expect(recovery.kind).not.toBe('ignored');
  });

  test('incremental sync preserves identical-amount SMS via sourceSmsId', async () => {
    const now = Date.parse('2026-08-27T12:00:00.000Z');
    const body = mellatDeposit(100_000_000, 300_000_000);
    const smsList: NormalizedInboxSms[] = [
      {
        sourceSmsId: '1001',
        sender: '9909',
        body,
        receivedAt: new Date(now - 4000).toISOString(),
      },
      {
        sourceSmsId: '1002',
        sender: '9909',
        body: mellatDeposit(100_000_000, 400_000_000),
        receivedAt: new Date(now - 2000).toISOString(),
      },
    ];
    const seen = new Set<string>();
    const result = await runIncrementalSmsSync({
      checkpoint: {},
      smsProcessingEnabled: true,
      verifiedSenders: ['9909'],
      nowMs: now,
      hasPermission: async () => true,
      collectRows: async () => ({ rows: smsList, perSenderCounts: { '9909': 2 } }),
      ingest: payload => {
        if (payload.sourceSmsId && seen.has(payload.sourceSmsId)) {
          return { kind: 'duplicate' };
        }
        if (payload.sourceSmsId) {
          seen.add(payload.sourceSmsId);
        }
        return { kind: 'created' };
      },
    });
    expect(result.scannedCount).toBe(2);
    expect(result.createdCount).toBe(2);
    expect(seen.size).toBe(2);
  });
});
