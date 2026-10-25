import type { BudgetCategory, CategoryId, Transaction } from '../../types/finance';
import { categoryTotals, isExpenseLike } from '../insights/analytics';
import { startOfJalaliMonth } from '../../utils/dates/jalali';

export const BUDGET_WARN_RATIO = 0.8;

export interface BudgetAlert {
  categoryId: CategoryId;
  usedRial: number;
  limitRial: number;
  ratio: number;
}

/** شروع ماه مالی شمسی — هم‌تراز با داشبورد */
export function monthStartMs(now = new Date()): number {
  return startOfJalaliMonth(now.toISOString()).getTime();
}

export function budgetAlerts(
  input: {
    transactions: Transaction[];
    budgetCategories: BudgetCategory[];
    settings: { budgetAlertsEnabled: boolean };
  },
  now = new Date(),
): BudgetAlert[] {
  if (!input.settings.budgetAlertsEnabled) {
    return [];
  }
  const start = monthStartMs(now);
  const spent = categoryTotals(
    input.transactions.filter(tx => isExpenseLike(tx) && Date.parse(tx.transactionDate) >= start),
  );
  return input.budgetCategories
    .filter(c => c.limitRial > 0)
    .map(c => {
      const usedRial = spent[c.categoryId] ?? 0;
      return {
        categoryId: c.categoryId,
        usedRial,
        limitRial: c.limitRial,
        ratio: usedRial / c.limitRial,
      };
    })
    .filter(row => row.ratio >= BUDGET_WARN_RATIO)
    .sort((a, b) => b.ratio - a.ratio);
}
