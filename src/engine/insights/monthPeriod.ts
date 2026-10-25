import type { FinanceSnapshot } from '../../database/schema/snapshot';
import { withSettingsDefaults } from '../../features/settings/lib/settingsDefaults';
import { startOfJalaliMonth } from '../../utils/dates/jalali';
import type { Transaction } from '../../types/finance';

export function financialMonthStart(snapshot: FinanceSnapshot, now = new Date(), offsetMonths = 0): Date {
  const settings = withSettingsDefaults(snapshot.settings);
  const startDay = Math.min(28, Math.max(1, settings.financialMonthStartDay ?? 1));

  let start: Date;
  if (settings.calendar === 'gregorian') {
    start = new Date(now.getFullYear(), now.getMonth(), startDay, 0, 0, 0, 0);
    if (start.getTime() > now.getTime()) {
      start = new Date(now.getFullYear(), now.getMonth() - 1, startDay, 0, 0, 0, 0);
    }
  } else {
    const monthStart = startOfJalaliMonth(now.toISOString());
    start = new Date(monthStart);
    if (startDay > 1) {
      start.setDate(start.getDate() + (startDay - 1));
    }
    start.setHours(0, 0, 0, 0);
    if (start.getTime() > now.getTime()) {
      start.setMonth(start.getMonth() - 1);
    }
  }

  if (offsetMonths !== 0) {
    start.setMonth(start.getMonth() + offsetMonths);
  }
  return start;
}

export function financialMonthTransactions(
  snapshot: FinanceSnapshot,
  offsetMonths = 0,
  now = new Date(),
): Transaction[] {
  const start = financialMonthStart(snapshot, now, offsetMonths);
  const end =
    offsetMonths === 0 ? now : financialMonthStart(snapshot, now, offsetMonths + 1);
  const startMs = start.getTime();
  const endMs = end.getTime();
  return snapshot.transactions.filter(tx => {
    const t = Date.parse(tx.transactionDate);
    return t >= startMs && t < endMs;
  });
}
