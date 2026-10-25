import type { FinanceSnapshot } from '../../database/schema/snapshot';

export interface SafeToSpend {
  /** What the month's pool is based on; 'none' means nothing to divide yet. */
  basis: 'budget' | 'income' | 'none';
  capRial: number;
  leftRial: number;
  /** Today's spend ÷ today's cap — drives warning tones (≥0.8 near, >1 over). */
  ratio: number;
}

/**
 * Even daily allowance for the rest of the financial month:
 * (pool − spent before today) ÷ days left including today.
 * Pool is the monthly budget when one exists, else this month's income.
 */
export function safeToSpendToday(input: {
  monthlyLimitRial: number | null;
  monthIncomeRial: number;
  monthExpenseRial: number;
  todayExpenseRial: number;
  dayOfMonth: number;
  daysInMonth: number;
}): SafeToSpend {
  const { monthlyLimitRial, monthIncomeRial, monthExpenseRial, todayExpenseRial } = input;
  const basis: SafeToSpend['basis'] =
    monthlyLimitRial && monthlyLimitRial > 0 ? 'budget' : monthIncomeRial > 0 ? 'income' : 'none';
  if (basis === 'none') {
    return { basis, capRial: 0, leftRial: 0, ratio: 0 };
  }
  const pool = basis === 'budget' ? (monthlyLimitRial as number) : monthIncomeRial;
  const spentBeforeToday = Math.max(0, monthExpenseRial - todayExpenseRial);
  const daysLeft = Math.max(1, input.daysInMonth - input.dayOfMonth + 1);
  const capRial = Math.max(0, Math.round((pool - spentBeforeToday) / daysLeft));
  const leftRial = capRial - todayExpenseRial;
  const ratio = capRial > 0 ? todayExpenseRial / capRial : todayExpenseRial > 0 ? Infinity : 0;
  return { basis, capRial, leftRial, ratio };
}

/** Most recent monthly budget's total limit, if the user set one. */
export function currentMonthlyLimitRial(snapshot: FinanceSnapshot): number | null {
  const monthly = snapshot.budgets
    .filter(b => b.period === 'monthly' && b.totalLimitRial > 0)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return monthly[0]?.totalLimitRial ?? null;
}
