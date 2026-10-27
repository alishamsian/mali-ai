import type { FinancialAccount, SyncQueueItem, Transaction } from '../../types/finance';
import { LocalFinanceDb } from '../../database/drivers/localDb';
import { getStorageDriver } from '../../database/drivers/storageBootstrap';
import { flushSyncQueue } from '../../services/sync/flush';
import { refreshPricesFromHoldings } from '../../features/wealth/pricing/providers';
import { useFinanceStore } from './store';

jest.mock('../../services/sync/flush', () => ({ flushSyncQueue: jest.fn() }));
jest.mock('../../features/wealth/pricing/providers', () => ({ refreshPricesFromHoldings: jest.fn() }));

const flushMock = flushSyncQueue as jest.MockedFunction<typeof flushSyncQueue>;
const pricesMock = refreshPricesFromHoldings as jest.MockedFunction<typeof refreshPricesFromHoldings>;

let amountSeed = 1_000_000;

/** Distinct amounts keep the cross-source duplicate check from merging test rows. */
function makeTx(id: string, overrides: Partial<Transaction> = {}): Transaction {
  amountSeed += 7_919;
  const now = new Date().toISOString();
  return {
    id,
    userId: 'local-user',
    accountId: 'acc_test',
    type: 'purchase',
    direction: 'out',
    amountRial: amountSeed,
    currency: 'IRR',
    merchant: `m-${id}`,
    categoryId: 'food',
    transactionDate: now,
    source: 'manual',
    fingerprint: `fp-${id}`,
    confidence: 1,
    isConfirmed: true,
    needsReview: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

const state = () => useFinanceStore.getState();
const txIds = () => state().snapshot.transactions.map(tx => tx.id);
const persisted = () => new LocalFinanceDb(getStorageDriver()).load();

beforeAll(async () => {
  await state().hydrate();
});

beforeEach(() => {
  flushMock.mockReset();
  pricesMock.mockReset();
});

describe('user actions during an SMS batch (bug 1)', () => {
  it('keeps a delete made mid-batch after the batch is written', () => {
    state().addTransaction(makeTx('tx_del_mid_batch'));
    state().beginSmsBatch();
    state().deleteTransaction('tx_del_mid_batch');
    state().endSmsBatch();

    expect(txIds()).not.toContain('tx_del_mid_batch');
    expect(persisted().transactions.map(tx => tx.id)).not.toContain('tx_del_mid_batch');
  });

  it('keeps an edit and a settings change made mid-batch', () => {
    state().addTransaction(makeTx('tx_edit_mid_batch'));
    state().beginSmsBatch();
    state().updateTransaction('tx_edit_mid_batch', { notes: 'edited during sync' });
    state().updateSettings({ hideBalances: true });
    state().endSmsBatch();

    const saved = persisted();
    expect(saved.transactions.find(tx => tx.id === 'tx_edit_mid_batch')?.notes).toBe(
      'edited during sync',
    );
    expect(saved.settings.hideBalances).toBe(true);
    state().updateSettings({ hideBalances: false });
  });

  it('keeps batch-only writes alongside a mid-batch user action', () => {
    state().addTransaction(makeTx('tx_user_before'));
    state().beginSmsBatch();
    state().addTransaction(makeTx('tx_from_batch'));
    state().deleteTransaction('tx_user_before');
    state().endSmsBatch();

    expect(txIds()).toContain('tx_from_batch');
    expect(txIds()).not.toContain('tx_user_before');
  });
});

describe('async actions re-read the snapshot after awaiting (bug 2)', () => {
  it('flushCloud keeps transactions and queue items added during the upload', async () => {
    state().addTransaction(makeTx('tx_before_flush'));
    const pending = deferred<{ queue: SyncQueueItem[]; ran: boolean }>();
    flushMock.mockReturnValueOnce(pending.promise);

    const flush = state().flushCloud();
    const sent = flushMock.mock.calls[0]?.[0] ?? [];
    expect(sent.some(item => item.entityId === 'tx_before_flush')).toBe(true);

    state().addTransaction(makeTx('tx_during_flush'));
    // Upload succeeded: the flushed queue has the sent items removed.
    pending.resolve({ queue: [], ran: true });
    await flush;

    expect(txIds()).toContain('tx_during_flush');
    const queued = state().snapshot.syncQueue.map(item => item.entityId);
    expect(queued).toContain('tx_during_flush');
    expect(queued).not.toContain('tx_before_flush');
  });

  it('flushCloud shares one in-flight upload between overlapping callers', async () => {
    state().addTransaction(makeTx('tx_overlap'));
    const pending = deferred<{ queue: SyncQueueItem[]; ran: boolean }>();
    flushMock.mockReturnValue(pending.promise);

    const a = state().flushCloud();
    const b = state().flushCloud();
    pending.resolve({ queue: [], ran: true });
    await Promise.all([a, b]);

    expect(flushMock).toHaveBeenCalledTimes(1);
  });

  it('refreshWealthPrices applies new prices without dropping edits made during the fetch', async () => {
    const gold: FinancialAccount = {
      id: 'acc_gold_test',
      userId: 'local-user',
      kind: 'asset',
      name: 'طلا',
      balanceRial: 100,
      transactionCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state().upsertAccount(gold);
    const pending = deferred<Awaited<ReturnType<typeof refreshPricesFromHoldings>>>();
    pricesMock.mockReturnValueOnce(pending.promise);

    const refresh = state().refreshWealthPrices();
    const priced = pricesMock.mock.calls[0][0];
    state().addTransaction(makeTx('tx_during_prices'));

    pending.resolve({
      accounts: priced.map(a => (a.id === gold.id ? { ...a, balanceRial: 500 } : a)),
      updated: 1,
      bundle: null,
    });
    await expect(refresh).resolves.toBe(1);

    expect(txIds()).toContain('tx_during_prices');
    expect(state().snapshot.accounts.find(a => a.id === gold.id)?.balanceRial).toBe(500);
  });

  it('refreshWealthPrices does not overwrite an account the user edited during the fetch', async () => {
    const pending = deferred<Awaited<ReturnType<typeof refreshPricesFromHoldings>>>();
    pricesMock.mockReturnValueOnce(pending.promise);

    const refresh = state().refreshWealthPrices();
    const priced = pricesMock.mock.calls[0][0];
    const gold = state().snapshot.accounts.find(a => a.id === 'acc_gold_test')!;
    state().upsertAccount({ ...gold, name: 'طلای ویرایش‌شده' });

    pending.resolve({
      accounts: priced.map(a => (a.id === gold.id ? { ...a, balanceRial: 900 } : a)),
      updated: 1,
      bundle: null,
    });
    await expect(refresh).resolves.toBe(0);

    const after = state().snapshot.accounts.find(a => a.id === gold.id)!;
    expect(after.name).toBe('طلای ویرایش‌شده');
    expect(after.balanceRial).toBe(500);
  });
});

describe('sync queue stays bounded in the store (bug 4)', () => {
  it('keeps one queue item per transaction across repeated edits', () => {
    state().addTransaction(makeTx('tx_many_edits'));
    for (let i = 0; i < 20; i += 1) {
      state().updateTransaction('tx_many_edits', { notes: `edit ${i}` });
    }
    const items = state().snapshot.syncQueue.filter(item => item.entityId === 'tx_many_edits');
    expect(items).toHaveLength(1);
    expect(JSON.parse(items[0].payload).notes).toBe('edit 19');
  });

  it('a delete replaces the pending upsert for the same transaction', () => {
    state().addTransaction(makeTx('tx_then_deleted'));
    state().deleteTransaction('tx_then_deleted');
    const items = state().snapshot.syncQueue.filter(item => item.entityId === 'tx_then_deleted');
    expect(items.map(item => item.operation)).toEqual(['delete']);
  });

  it('flushCloud writes nothing when there is no cloud client or user', async () => {
    flushMock.mockResolvedValueOnce({ queue: state().snapshot.syncQueue, ran: false });
    const before = state().snapshot;
    await state().flushCloud();
    expect(state().snapshot).toBe(before);
  });
});
