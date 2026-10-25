import type { Transaction } from '../../types/finance';
import { jalaliMonthMeta, isoForJalaliDayKey, toJalaliYmd } from '../../utils/dates/jalali';
import { isExpenseLike, isIncomeLike } from './analytics';

export interface JalaliDayFlow {
  day: number;
  incomeRial: number;
  expenseRial: number;
}

export interface JalaliCashflow {
  year: number;
  month: number;
  day: number;
  daysInMonth: number;
  lead: number;
  startIso: string;
  days: JalaliDayFlow[];
}

export function buildJalaliCashflow(transactions: Transaction[], now = new Date()): JalaliCashflow {
  const meta = jalaliMonthMeta(now);
  const days: JalaliDayFlow[] = Array.from({ length: meta.daysInMonth }, (_, i) => ({
    day: i + 1,
    incomeRial: 0,
    expenseRial: 0,
  }));
  for (const tx of transactions) {
    const part = toJalaliYmd(tx.transactionDate);
    if (part.year !== meta.year || part.month !== meta.month) {
      continue;
    }
    const slot = days[part.day - 1];
    if (!slot) {
      continue;
    }
    if (isIncomeLike(tx)) {
      slot.incomeRial += tx.amountRial;
    } else if (isExpenseLike(tx)) {
      slot.expenseRial += tx.amountRial;
    }
  }
  return {
    year: meta.year,
    month: meta.month,
    day: meta.day,
    daysInMonth: meta.daysInMonth,
    lead: meta.lead,
    startIso: meta.start.toISOString(),
    days,
  };
}

export function buildJalaliCashflowForDayKey(
  transactions: Transaction[],
  dayKey: string,
): JalaliCashflow {
  return buildJalaliCashflow(transactions, new Date(isoForJalaliDayKey(dayKey)));
}
