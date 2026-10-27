import type { FinancialAccount, Transaction } from '../../types/finance';
import { useFinanceStore } from './store';

const state = () => useFinanceStore.getState();
const balance = (id: string) => state().snapshot.accounts.find(a => a.id === id)?.balanceRial;

function account(id: string, balanceRial: number): FinancialAccount {
  const now = new Date().toISOString();
  return {
    id,
    userId: 'local-user',
    kind: 'cash',
    name: id,
    balanceRial,
    transactionCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function tx(id: string, accountId: string, overrides: Partial<Transaction>): Transaction {
  const now = new Date().toISOString();
  return {
    id,
    userId: 'local-user',
    accountId,
    type: 'purchase',
    direction: 'out',
    amountRial: 100,
    currency: 'IRR',
    merchant: id,
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

function smsTx(id: string, accountId: string, amountRial: number, balanceAfterRial: number, date: string) {
  return tx(id, accountId, {
    source: 'android_sms',
    sourceSmsId: id,
    amountRial,
    balanceAfterRial,
    transactionDate: date,
  });
}

beforeAll(async () => {
  await state().hydrate();
});

describe('balances on delete', () => {
  it('a manual transaction is undone by its amount', () => {
    state().upsertAccount(account('acc_manual_del', 10_000));
    state().addTransaction(tx('tx_manual_del', 'acc_manual_del', { amountRial: 1_234 }));
    expect(balance('acc_manual_del')).toBe(8_766);
    state().deleteTransaction('tx_manual_del');
    expect(balance('acc_manual_del')).toBe(10_000);
  });

  it('deleting the latest SMS falls back to the previous SMS balance, not balance + amount', () => {
    state().upsertAccount(account('acc_sms_del', 0));
    state().addTransaction(smsTx('sms_old', 'acc_sms_del', 500, 1_000, '2026-10-01T08:00:00.000Z'));
    // 300 out, but the bank also took a 50 fee: balance 650, not 700.
    state().addTransaction(smsTx('sms_new', 'acc_sms_del', 300, 650, '2026-10-02T08:00:00.000Z'));
    expect(balance('acc_sms_del')).toBe(650);

    state().deleteTransaction('sms_new');
    expect(balance('acc_sms_del')).toBe(1_000);
  });

  it('deleting an older SMS keeps the latest bank balance', () => {
    state().upsertAccount(account('acc_sms_old_del', 0));
    state().addTransaction(smsTx('sms_a', 'acc_sms_old_del', 400, 2_000, '2026-10-01T08:00:00.000Z'));
    state().addTransaction(smsTx('sms_b', 'acc_sms_old_del', 700, 1_300, '2026-10-02T08:00:00.000Z'));
    state().deleteTransaction('sms_a');
    expect(balance('acc_sms_old_del')).toBe(1_300);
  });

  it('deleting the only SMS returns the account to its balance before that SMS', () => {
    state().upsertAccount(account('acc_sms_only', 0));
    state().addTransaction(smsTx('sms_only', 'acc_sms_only', 250, 4_750, '2026-10-03T08:00:00.000Z'));
    state().deleteTransaction('sms_only');
    expect(balance('acc_sms_only')).toBe(5_000);
  });
});

describe('balances on edit', () => {
  it('changing the amount of a manual transaction adjusts the balance', () => {
    state().upsertAccount(account('acc_edit_amount', 10_000));
    state().addTransaction(tx('tx_edit_amount', 'acc_edit_amount', { amountRial: 1_000 }));
    state().updateTransaction('tx_edit_amount', { amountRial: 2_500 });
    expect(balance('acc_edit_amount')).toBe(7_500);
  });

  it('flipping direction moves the balance both ways', () => {
    state().upsertAccount(account('acc_edit_dir', 10_000));
    state().addTransaction(tx('tx_edit_dir', 'acc_edit_dir', { amountRial: 1_111 }));
    state().updateTransaction('tx_edit_dir', { direction: 'in' });
    expect(balance('acc_edit_dir')).toBe(11_111);
  });

  it('moving a manual transaction to another account moves its effect and count', () => {
    state().upsertAccount(account('acc_from', 10_000));
    state().upsertAccount(account('acc_to', 3_000));
    state().addTransaction(tx('tx_move', 'acc_from', { amountRial: 1_500 }));
    state().updateTransaction('tx_move', { accountId: 'acc_to' });
    expect(balance('acc_from')).toBe(10_000);
    expect(balance('acc_to')).toBe(1_500);
    const counts = state().snapshot.accounts.filter(a => a.id === 'acc_from' || a.id === 'acc_to');
    expect(counts.map(a => [a.id, a.transactionCount]).sort()).toEqual([
      ['acc_from', 0],
      ['acc_to', 1],
    ]);
  });

  it('editing an SMS amount keeps the bank-reported balance', () => {
    state().upsertAccount(account('acc_sms_edit', 0));
    state().addTransaction(smsTx('sms_edit', 'acc_sms_edit', 900, 6_100, '2026-10-04T08:00:00.000Z'));
    state().updateTransaction('sms_edit', { amountRial: 950 });
    expect(balance('acc_sms_edit')).toBe(6_100);
  });

  it('a non-money edit leaves balances alone', () => {
    state().upsertAccount(account('acc_note', 10_000));
    state().addTransaction(tx('tx_note', 'acc_note', { amountRial: 2_222 }));
    state().updateTransaction('tx_note', { notes: 'just a note' });
    expect(balance('acc_note')).toBe(7_778);
  });
});

describe('manual entries that duplicate an SMS transaction', () => {
  const smsAt = '2026-10-05T09:00:00.000Z';

  it('are not added silently: addTransaction reports false and adds nothing', () => {
    state().upsertAccount(account('acc_dup', 0));
    state().addTransaction(smsTx('sms_dup', 'acc_dup', 777_000, 9_000_000, smsAt));
    const manual = tx('tx_manual_dup', 'acc_dup', { amountRial: 777_000, transactionDate: smsAt, merchant: undefined });

    expect(state().addTransaction(manual)).toBe(false);
    expect(state().snapshot.transactions.some(t => t.id === 'tx_manual_dup')).toBe(false);
  });

  it('are added when the user confirms they are separate', () => {
    const manual = tx('tx_manual_dup2', 'acc_dup', { amountRial: 777_000, transactionDate: smsAt, merchant: undefined });
    expect(state().addTransaction(manual, { allowDuplicate: true })).toBe(true);
    expect(state().snapshot.transactions.some(t => t.id === 'tx_manual_dup2')).toBe(true);
  });

  it('show up at once when added during an SMS sync', () => {
    state().upsertAccount(account('acc_mid_sync', 1_000));
    state().beginSmsBatch();
    state().addTransaction(tx('tx_manual_mid_sync', 'acc_mid_sync', { amountRial: 333 }));
    const visible = state().snapshot.transactions.some(t => t.id === 'tx_manual_mid_sync');
    state().endSmsBatch();
    expect(visible).toBe(true);
    expect(balance('acc_mid_sync')).toBe(667);
  });
});
