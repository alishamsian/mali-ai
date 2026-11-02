import { useFinanceStore } from './store';
import { emptySnapshot } from '../../database/schema/snapshot';
import { isExpenseLike } from '../../engine/insights/analytics';
import type { Transaction } from '../../types/finance';

const tx = (id: string, direction: 'in' | 'out', amountRial: number): Transaction =>
  ({
    id,
    userId: 'u',
    accountId: 'a',
    type: direction === 'out' ? 'withdrawal' : 'deposit',
    direction,
    amountRial,
    currency: 'IRR',
    transactionDate: '2026-11-01T10:00:00Z',
    source: 'android_sms',
    confidence: 1,
    isConfirmed: true,
    needsReview: false,
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-01T10:00:00Z',
  } as Transaction);

test('a card withdrawal booked as a loan leaves spending and becomes money owed to me', async () => {
  await useFinanceStore.getState().hydrate();
  const data = emptySnapshot();
  data.transactions = [tx('out1', 'out', 3_000_000), tx('in1', 'in', 1_000_000)];
  useFinanceStore.setState({ snapshot: data, hydrated: true });
  const store = useFinanceStore.getState();
  store.linkTransactionToDebt('out1', { person: 'مریم' });
  let s = useFinanceStore.getState().snapshot;
  const debt = s.debts[0];
  expect(debt).toMatchObject({ person: 'مریم', direction: 'lent', amountRial: 3_000_000 });
  expect(isExpenseLike(s.transactions.find(t => t.id === 'out1')!)).toBe(false);
  // Part of it comes back: a repayment, not income.
  store.linkTransactionToDebt('in1', { debtId: debt.id });
  s = useFinanceStore.getState().snapshot;
  expect(s.debts[0].settlements.map(x => x.amountRial)).toEqual([1_000_000]);
  expect(s.transactions.find(t => t.id === 'in1')?.debtId).toBe(debt.id);
  // Deleting the debt makes both ordinary transactions again.
  store.deleteDebt(debt.id);
  s = useFinanceStore.getState().snapshot;
  expect(s.transactions.every(t => !t.debtId)).toBe(true);
});
