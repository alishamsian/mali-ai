import type { FinancialAccount, SyncQueueItem, Transaction } from '../../types/finance';
import { getSupabase } from '../supabase/client';
import { cloudIdFor, flushSyncQueue } from './flush';
import { createQueueItem } from './queue';

jest.mock('../supabase/client', () => ({ getSupabase: jest.fn() }));

const getSupabaseMock = getSupabase as jest.Mock;
const USER = '11111111-2222-4333-8444-555555555555';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type Call = { table: string; op: 'upsert' | 'delete'; rows?: Record<string, unknown>[]; id?: string };

function fakeClient(
  opts: {
    failTable?: string;
    user?: boolean;
    /** Simulates a row the database rejects (constraint, bad value): its request fails. */
    rejectRow?: (row: Record<string, unknown>) => boolean;
  } = {},
) {
  const calls: Call[] = [];
  const result = (table: string, rows?: Record<string, unknown>[]) => {
    if (opts.failTable === table) {
      return Promise.resolve({ error: { message: `${table} down` } });
    }
    if (rows) {
      // PostgREST rejects bulk rows whose key sets differ; compare what goes over the wire
      // (JSON drops undefined values).
      const keys = rows.map(r => Object.keys(JSON.parse(JSON.stringify(r))).sort().join(','));
      if (new Set(keys).size > 1) {
        return Promise.resolve({ error: { message: 'All object keys must match' } });
      }
      if (opts.rejectRow && rows.some(opts.rejectRow)) {
        return Promise.resolve({ error: { message: 'violates not-null constraint' } });
      }
    }
    return Promise.resolve({ error: null });
  };
  const client = {
    auth: {
      getUser: async () => ({ data: { user: opts.user === false ? null : { id: USER } } }),
    },
    from: (table: string) => ({
      upsert: (rows: Record<string, unknown>[]) => {
        calls.push({ table, op: 'upsert', rows });
        return result(table, rows);
      },
      delete: () => ({
        eq: (_col: string, id: string) => {
          calls.push({ table, op: 'delete', id });
          return result(table);
        },
      }),
    }),
  };
  getSupabaseMock.mockReturnValue(client);
  return calls;
}

const account: FinancialAccount = {
  id: 'acc_sms_mellat_1234',
  userId: 'local-user',
  kind: 'bank',
  bankId: 'mellat',
  name: 'ملت',
  cardLast4: '1234',
  balanceRial: 5_000_000,
  transactionCount: 1,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

const tx: Transaction = {
  id: 'tx_sms42',
  userId: 'local-user',
  accountId: account.id,
  type: 'purchase',
  direction: 'out',
  amountRial: 250_000,
  currency: 'IRR',
  categoryId: 'food',
  transactionDate: '2026-10-02T10:00:00.000Z',
  source: 'android_sms',
  fingerprint: 'fp42',
  confidence: 0.9,
  isConfirmed: true,
  needsReview: false,
  createdAt: '2026-10-02T10:00:00.000Z',
  updatedAt: '2026-10-02T10:00:00.000Z',
};

describe('cloudIdFor (bug 3)', () => {
  it('maps local ids to a stable, valid UUID per user', () => {
    const id = cloudIdFor(USER, 'tx_sms42');
    expect(id).toMatch(UUID_RE);
    expect(cloudIdFor(USER, 'tx_sms42')).toBe(id);
    expect(cloudIdFor(USER, 'tx_sms43')).not.toBe(id);
    expect(cloudIdFor('other-user', 'tx_sms42')).not.toBe(id);
  });

  it('passes real UUIDs through', () => {
    expect(cloudIdFor(USER, USER)).toBe(USER);
  });
});

describe('flushSyncQueue (bugs 3 and 4)', () => {
  beforeEach(() => getSupabaseMock.mockReset());

  it('returns the queue untouched and ran=false without a client or user', async () => {
    const queue = [createQueueItem('transactions', tx.id, 'upsert', tx)];
    getSupabaseMock.mockReturnValue(null);
    await expect(flushSyncQueue(queue, { accounts: [] })).resolves.toEqual({ queue, ran: false });
    fakeClient({ user: false });
    await expect(flushSyncQueue(queue, { accounts: [] })).resolves.toEqual({ queue, ran: false });
  });

  it('uploads local-id transactions with their account first, then drops them from the queue', async () => {
    const calls = fakeClient();
    const queue = [createQueueItem('transactions', tx.id, 'upsert', tx)];
    const { queue: next, ran } = await flushSyncQueue(queue, { accounts: [account] });

    expect(ran).toBe(true);
    expect(next).toEqual([]);
    expect(calls.map(c => `${c.table}:${c.op}`)).toEqual([
      'financial_accounts:upsert',
      'transactions:upsert',
    ]);
    const accountRow = calls[0].rows![0];
    const txRow = calls[1].rows![0];
    expect(accountRow.id).toBe(cloudIdFor(USER, account.id));
    expect(txRow.id).toBe(cloudIdFor(USER, tx.id));
    expect(txRow.account_id).toBe(accountRow.id);
    expect(txRow.user_id).toBe(USER);
    expect(txRow.category_id).toBe('food');
  });

  it('sends deletes as deletes, not upserts', async () => {
    const calls = fakeClient();
    const queue = [
      createQueueItem('transactions', tx.id, 'delete', { id: tx.id }),
      createQueueItem('financial_accounts', account.id, 'delete', { id: account.id }),
    ];
    const { queue: next } = await flushSyncQueue(queue, { accounts: [] });

    expect(next).toEqual([]);
    expect(calls).toEqual([
      { table: 'transactions', op: 'delete', id: cloudIdFor(USER, tx.id) },
      { table: 'financial_accounts', op: 'delete', id: cloudIdFor(USER, account.id) },
    ]);
  });

  it('actually uploads queued account upserts instead of only marking them synced', async () => {
    const calls = fakeClient();
    const queue = [createQueueItem('financial_accounts', account.id, 'upsert', account)];
    await flushSyncQueue(queue, { accounts: [account] });
    expect(calls).toHaveLength(1);
    expect(calls[0].rows![0]).toMatchObject({ name: 'ملت', balance_rial: 5_000_000 });
  });

  it('sends a null account_id when the account no longer exists locally', async () => {
    const calls = fakeClient();
    const queue = [createQueueItem('transactions', tx.id, 'upsert', tx)];
    await flushSyncQueue(queue, { accounts: [] });
    expect(calls.map(c => c.table)).toEqual(['transactions']);
    expect(calls[0].rows![0].account_id).toBeNull();
  });

  it('keeps failed items for retry with backoff', async () => {
    fakeClient({ failTable: 'transactions' });
    const queue = [createQueueItem('transactions', tx.id, 'upsert', tx)];
    const { queue: next } = await flushSyncQueue(queue, { accounts: [account] });
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ status: 'failed', attempts: 1, lastError: 'transactions down' });
    expect(Date.parse(next[0].nextRetryAt!)).toBeGreaterThan(Date.now());
  });

  it('leaves items that are still backing off alone and prunes synced leftovers', async () => {
    const calls = fakeClient();
    const waiting: SyncQueueItem = {
      ...createQueueItem('transactions', 'tx_wait', 'upsert', { ...tx, id: 'tx_wait' }),
      status: 'failed',
      attempts: 2,
      nextRetryAt: new Date(Date.now() + 60_000).toISOString(),
    };
    const synced: SyncQueueItem = { ...createQueueItem('transactions', 'tx_old', 'upsert', {}), status: 'synced' };
    const { queue: next } = await flushSyncQueue([synced, waiting], { accounts: [] });
    expect(calls).toEqual([]);
    expect(next).toEqual([waiting]);
  });

  it('batches large uploads into chunks', async () => {
    const calls = fakeClient();
    const queue = Array.from({ length: 450 }, (_, i) =>
      createQueueItem('transactions', `tx_${i}`, 'upsert', { ...tx, id: `tx_${i}` }),
    );
    const { queue: next } = await flushSyncQueue(queue, { accounts: [account] });
    expect(next).toEqual([]);
    expect(calls.filter(c => c.table === 'transactions').map(c => c.rows!.length)).toEqual([
      200, 200, 50,
    ]);
  });

  it('sends every column even when an older record lacks some fields', async () => {
    const calls = fakeClient();
    const legacy = { ...tx, id: 'tx_legacy', createdAt: undefined, fingerprint: undefined } as never;
    const queue = [
      createQueueItem('transactions', tx.id, 'upsert', tx),
      createQueueItem('transactions', 'tx_legacy', 'upsert', legacy),
    ];
    const { queue: next } = await flushSyncQueue(queue, {
      accounts: [{ ...account, createdAt: undefined } as never],
    });
    expect(next).toEqual([]);
    const txCall = calls.find(c => c.table === 'transactions')!;
    const wireKeys = (row: object) => Object.keys(JSON.parse(JSON.stringify(row))).sort();
    expect(wireKeys(txCall.rows![0])).toEqual(wireKeys(txCall.rows![1]));
    expect(txCall.rows![1]).toMatchObject({ fingerprint: 'tx_legacy' });
    expect(calls.find(c => c.table === 'financial_accounts')!.rows![0].created_at).toEqual(
      expect.any(String),
    );
  });

  it('one rejected row only holds back itself, not its whole batch', async () => {
    const calls = fakeClient({ rejectRow: row => row.local_id === 'tx_bad' });
    const queue = ['tx_a', 'tx_bad', 'tx_b'].map(id =>
      createQueueItem('transactions', id, 'upsert', { ...tx, id }),
    );
    const { queue: next } = await flushSyncQueue(queue, { accounts: [account] });

    expect(next.map(i => i.entityId)).toEqual(['tx_bad']);
    expect(next[0]).toMatchObject({ status: 'failed', lastError: 'violates not-null constraint' });
    // One failed bulk request, then one request per row.
    expect(calls.filter(c => c.table === 'transactions').map(c => c.rows!.length)).toEqual([
      3, 1, 1, 1,
    ]);
  });
});
