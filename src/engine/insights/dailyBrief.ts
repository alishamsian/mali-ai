import type { RecurringTransaction, Transaction } from '../../types/finance';
import { jalaliDayKey, shiftJalaliDayKey } from '../../utils/dates/jalali';
import { isExpenseLike } from './analytics';
import type { ProIntel } from './pro';

export type DailyBrief = {
  code: 'quiet' | 'cooler' | 'hotter' | 'due' | 'paceCool' | 'paceHot' | 'spent';
  vars: Record<string, string | number>;
};

function spendOnJalaliDay(transactions: Transaction[], key: string): number {
  return transactions
    .filter(tx => isExpenseLike(tx) && jalaliDayKey(tx.transactionDate) === key)
    .reduce((s, tx) => s + tx.amountRial, 0);
}

export function dailyBrief(
  transactions: Transaction[],
  intel: ProIntel,
  recurring: RecurringTransaction[],
  now = new Date(),
): DailyBrief | null {
  if (transactions.length === 0) {
    return null;
  }
  const todayKey = jalaliDayKey(now);
  const yesterdayKey = shiftJalaliDayKey(todayKey, -1);
  const todaySpend = spendOnJalaliDay(transactions, todayKey);
  const yesterdaySpend = spendOnJalaliDay(transactions, yesterdayKey);
  if (todaySpend === 0 && yesterdaySpend === 0) {
    return { code: 'quiet', vars: {} };
  }
  if (yesterdaySpend > 0 && todaySpend < yesterdaySpend) {
    return { code: 'cooler', vars: {} };
  }
  if (yesterdaySpend > 0 && todaySpend > yesterdaySpend) {
    return { code: 'hotter', vars: {} };
  }
  if (todaySpend === 0) {
    return { code: 'quiet', vars: {} };
  }
  const due = recurring
    .map(item => ({
      name: item.merchant,
      n: Math.round((Date.parse(item.nextExpectedDate) - now.getTime()) / 86400000),
    }))
    .filter(item => item.n >= 0 && item.n <= 3)
    .sort((a, b) => a.n - b.n)[0];
  if (due) {
    return { code: 'due', vars: { n: due.n, name: due.name } };
  }
  if (intel.paceRatio > 0 && intel.paceRatio < 0.9) {
    return { code: 'paceCool', vars: {} };
  }
  if (intel.paceRatio > 1.08) {
    return { code: 'paceHot', vars: {} };
  }
  return { code: 'spent', vars: { amountRial: intel.monthExpenseRial } };
}
