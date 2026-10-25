import { budgetAlerts, monthStartMs } from './alerts';
import { startOfJalaliMonth } from '../../utils/dates/jalali';
import type { BudgetCategory, Transaction } from '../../types/finance';

describe('budgetAlerts jalali month', () => {
  it('uses jalali month start', () => {
    const now = new Date('2026-08-27T12:00:00.000Z');
    expect(monthStartMs(now)).toBe(startOfJalaliMonth(now.toISOString()).getTime());
  });

  it('flags over-budget categories in current jalali month', () => {
    const now = new Date('2026-08-27T12:00:00.000Z');
    const start = startOfJalaliMonth(now.toISOString()).toISOString();
    const txs: Transaction[] = [
      {
        id: '1',
        userId: 'u',
        accountId: 'a',
        type: 'purchase',
        direction: 'out',
        amountRial: 900_000,
        currency: 'IRR',
        categoryId: 'food',
        transactionDate: start,
        createdAt: start,
        updatedAt: start,
        source: 'manual',
        fingerprint: 'f1',
        isConfirmed: true,
        needsReview: false,
        confidence: 1,
      },
    ];
    const cats: BudgetCategory[] = [
      {
        id: 'bc1',
        budgetId: 'b1',
        categoryId: 'food',
        limitRial: 1_000_000,
      },
    ];
    const alerts = budgetAlerts(
      { transactions: txs, budgetCategories: cats, settings: { budgetAlertsEnabled: true } },
      now,
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].ratio).toBeGreaterThanOrEqual(0.8);
  });
});
