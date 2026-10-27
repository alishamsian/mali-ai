import type { FinancialAccount, Transaction } from '../../types/finance';
import { pullCloudRecords } from '../../services/sync/pull';
import { useFinanceStore } from './store';

jest.mock('../../services/sync/pull', () => ({ pullCloudRecords: jest.fn() }));

const pullMock = pullCloudRecords as jest.MockedFunction<typeof pullCloudRecords>;
const state = () => useFinanceStore.getState();

const now = '2026-10-10T08:00:00.000Z';

function account(id: string, balanceRial: number): FinancialAccount {
  return {
    id,
    userId: 'local-user',
    kind: 'bank',
    name: id,
    balanceRial,
    transactionCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function tx(id: string, accountId: string, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id,
    userId: 'local-user',
    accountId,
    type: 'purchase',
    direction: 'out',
    amountRial: 1_000,
    currency: 'IRR',
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

beforeAll(async () => {
  await state().hydrate();
});

describe('restoreFromCloud', () => {
  it('adds missing accounts and transactions without touching local ones', async () => {
    state().upsertAccount(account('acc_local', 10_000));
    state().addTransaction(tx('tx_local', 'acc_local', { amountRial: 1_111, notes: 'local edit' }));

    pullMock.mockResolvedValueOnce({
      ok: true,
      records: {
        accounts: [account('acc_local', 1), account('acc_cloud', 0)],
        transactions: [
          tx('tx_local', 'acc_local', { amountRial: 1_111, notes: 'cloud version' }),
          tx('tx_cloud_sms', 'acc_cloud', {
            source: 'android_sms',
            sourceSmsId: 'sms_77',
            amountRial: 500,
            balanceAfterRial: 42_000,
          }),
        ],
      },
    });

    await expect(state().restoreFromCloud()).resolves.toEqual({
      ok: true,
      addedTransactions: 1,
      addedAccounts: 1,
    });
    const snap = state().snapshot;
    expect(snap.transactions.find(t => t.id === 'tx_local')?.notes).toBe('local edit');
    expect(snap.accounts.find(a => a.id === 'acc_local')?.balanceRial).toBe(8_889);
    // Restored SMS rows re-derive the bank balance.
    expect(snap.accounts.find(a => a.id === 'acc_cloud')?.balanceRial).toBe(42_000);
  });

  it('skips a cloud row whose SMS is already on the device under another id', async () => {
    state().upsertAccount(account('acc_sms_dup', 0));
    state().addTransaction(
      tx('tx_device_sms', 'acc_sms_dup', { source: 'android_sms', sourceSmsId: 'sms_88', amountRial: 640 }),
    );
    pullMock.mockResolvedValueOnce({
      ok: true,
      records: {
        accounts: [],
        transactions: [
          tx('tx_other_id', 'acc_sms_dup', { source: 'android_sms', sourceSmsId: 'sms_88' }),
        ],
      },
    });
    await expect(state().restoreFromCloud()).resolves.toMatchObject({ addedTransactions: 0 });
  });

  it('does not queue restored rows for upload again', async () => {
    pullMock.mockResolvedValueOnce({
      ok: true,
      records: { accounts: [], transactions: [tx('tx_restored_only', 'acc_cloud', { amountRial: 9 })] },
    });
    await state().restoreFromCloud();
    expect(state().snapshot.syncQueue.some(i => i.entityId === 'tx_restored_only')).toBe(false);
  });

  it('passes errors through', async () => {
    pullMock.mockResolvedValueOnce({ ok: false, error: 'signed-out' });
    await expect(state().restoreFromCloud()).resolves.toEqual({ ok: false, error: 'signed-out' });
  });
});

describe('enqueueFullUpload', () => {
  it('queues every real account and transaction once', () => {
    state().enqueueFullUpload();
    state().enqueueFullUpload();
    const snap = state().snapshot;
    const queuedTx = snap.syncQueue.filter(i => i.entity === 'transactions').map(i => i.entityId);
    expect(new Set(queuedTx).size).toBe(queuedTx.length);
    for (const t of snap.transactions) {
      expect(queuedTx).toContain(t.id);
    }
    const queuedAccounts = snap.syncQueue.filter(i => i.entity === 'financial_accounts');
    expect(queuedAccounts.length).toBe(snap.accounts.length);
  });
});
