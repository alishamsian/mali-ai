import type { CategoryId, Transaction } from '../../types/finance';
import type { UserSettings } from '../../types/finance';
import { currentMonthWindow } from './monthPeriod';

/** The user's financial-month settings; empty means the calendar month. */
type MonthSettings = Pick<Partial<UserSettings>, 'financialMonthStartDay' | 'calendar'>;
import { isExpenseLike } from './analytics';

const DAY_MS = 86_400_000;
/** Days of history behind the long-run daily pace. */
const HISTORY_DAYS = 90;

export interface MonthForecast {
  spentRial: number;
  /** Expected total for the whole month: spent + expected day-to-day + known dues. */
  projectedRial: number;
  /** Low/high band around the day-to-day part. */
  lowRial: number;
  highRial: number;
  /** Open cheques/installments/bills still due this month, counted as certain. */
  scheduledRial: number;
  lastMonthRial: number;
  day: number;
  daysInMonth: number;
}

function expensesBetween(transactions: Transaction[], from: number, to: number): Transaction[] {
  return transactions.filter(tx => {
    const at = Date.parse(tx.transactionDate);
    return at >= from && at < to && isExpenseLike(tx);
  });
}

/** A forecast to the toman looks falsely exact; round to 10,000 toman. */
const ROUND_RIAL = 100_000;
const roundForecast = (rial: number) => Math.round(rial / ROUND_RIAL) * ROUND_RIAL;

const sum = (txs: Transaction[]) => txs.reduce((s, tx) => s + tx.amountRial, 0);

/**
 * Month-end spend from two paces: this month's so far and the last 90 days'. Early in
 * the month the long-run pace dominates (a single rent payment on day 2 would otherwise
 * project a fortune); by month end this month's pace does.
 */
export function monthForecast(
  transactions: Transaction[],
  now: Date,
  scheduledRial = 0,
  settings: MonthSettings = {},
): MonthForecast {
  const meta = currentMonthWindow(settings, now);
  const start = meta.start.getTime();
  const end = now.getTime();
  const spentRial = sum(expensesBetween(transactions, start, end));

  const elapsedDays = Math.max(1, (end - start) / DAY_MS);
  const daysLeft = Math.max(0, meta.daysInMonth - elapsedDays);
  const history = expensesBetween(transactions, end - HISTORY_DAYS * DAY_MS, start);
  const historyDays = history.length
    ? Math.max(1, (start - Math.min(...history.map(tx => Date.parse(tx.transactionDate)))) / DAY_MS)
    : 0;
  const monthPace = spentRial / elapsedDays;
  const longPace = historyDays ? sum(history) / historyDays : monthPace;
  const weight = Math.min(1, elapsedDays / meta.daysInMonth);
  const pace = monthPace * weight + longPace * (1 - weight);
  const ahead = pace * daysLeft;
  // Wider band when the two paces disagree, narrowing as the month runs out.
  const spread = Math.abs(monthPace - longPace) * daysLeft * 0.5 + ahead * 0.1;

  const prevStart = meta.previousStart.getTime();
  return {
    spentRial,
    projectedRial: roundForecast(spentRial + ahead + scheduledRial),
    lowRial: roundForecast(spentRial + Math.max(0, ahead - spread) + scheduledRial),
    highRial: roundForecast(spentRial + ahead + spread + scheduledRial),
    scheduledRial,
    lastMonthRial: sum(expensesBetween(transactions, prevStart, start)),
    day: meta.day,
    daysInMonth: meta.daysInMonth,
  };
}

export interface CategoryDelta {
  id: CategoryId;
  currentRial: number;
  previousRial: number;
  deltaRial: number;
}

export interface ChangeBreakdown {
  currentRial: number;
  previousRial: number;
  deltaRial: number;
  /** Largest movers first (by absolute change). */
  rows: CategoryDelta[];
}

/** This month so far vs last month over the same number of days, split by category. */
export function changeBreakdown(
  transactions: Transaction[],
  now: Date,
  limit = 5,
  settings: MonthSettings = {},
): ChangeBreakdown {
  const window = currentMonthWindow(settings, now);
  const start = window.start.getTime();
  const prevStart = window.previousStart.getTime();
  const elapsed = now.getTime() - start;
  const byCat = (txs: Transaction[]) => {
    const map = new Map<CategoryId, number>();
    for (const tx of txs) {
      map.set(tx.categoryId, (map.get(tx.categoryId) ?? 0) + tx.amountRial);
    }
    return map;
  };
  const cur = byCat(expensesBetween(transactions, start, now.getTime()));
  const prev = byCat(
    expensesBetween(transactions, prevStart, Math.min(start, prevStart + elapsed)),
  );
  const ids = new Set([...cur.keys(), ...prev.keys()]);
  const rows = [...ids]
    .map(id => {
      const currentRial = cur.get(id) ?? 0;
      const previousRial = prev.get(id) ?? 0;
      return { id, currentRial, previousRial, deltaRial: currentRial - previousRial };
    })
    .filter(r => r.deltaRial !== 0)
    .sort((a, b) => Math.abs(b.deltaRial) - Math.abs(a.deltaRial));
  const currentRial = [...cur.values()].reduce((s, n) => s + n, 0);
  const previousRial = [...prev.values()].reduce((s, n) => s + n, 0);
  return {
    currentRial,
    previousRial,
    deltaRial: currentRial - previousRial,
    rows: rows.slice(0, limit),
  };
}
