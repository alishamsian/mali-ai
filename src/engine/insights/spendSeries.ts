import type { Transaction } from '../../types/finance';
import { isExpenseLike } from './analytics';
import { isoForJalaliDayKey, jalaliDayKey, shiftJalaliDayKey } from '../../utils/dates/jalali';

export const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const;

const WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] as const;
const WEEKDAY_NAMES = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'] as const;

export interface SpendPoint {
  /** Short label under the chart (weekday letter or month name). */
  label: string;
  /** Second label line (day of month); empty for months. */
  sub: string;
  /** Full name for screen readers. */
  name: string;
  /** Expense in rial; null for days/months that have not happened yet. */
  current: number | null;
  /** Same slot one period earlier (last week / same month last year). */
  previous: number;
}

export interface SpendSeries {
  points: SpendPoint[];
  /** Index of today / this month — the default selection. */
  todayIndex: number;
  currentTotal: number;
  /** Previous period up to the same point, so a half-finished week compares fairly. */
  previousToDate: number;
}

function expenseByDay(transactions: Transaction[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const tx of transactions) {
    if (!isExpenseLike(tx)) {
      continue;
    }
    const key = jalaliDayKey(tx.transactionDate);
    map.set(key, (map.get(key) ?? 0) + tx.amountRial);
  }
  return map;
}

/** Saturday-first week (Iranian week) containing `todayKey`, compared with the week before. */
export function weekSpendSeries(transactions: Transaction[], todayKey: string): SpendSeries {
  const byDay = expenseByDay(transactions);
  // JS getDay: Sun=0 … Sat=6 → Sat=0 … Fri=6
  const todayIndex = (new Date(isoForJalaliDayKey(todayKey)).getDay() + 1) % 7;
  const points: SpendPoint[] = WEEKDAYS.map((label, i) => {
    const key = shiftJalaliDayKey(todayKey, i - todayIndex);
    const day = Number(key.split('-')[2]);
    return {
      label,
      sub: String(day),
      name: WEEKDAY_NAMES[i],
      current: i <= todayIndex ? byDay.get(key) ?? 0 : null,
      previous: byDay.get(shiftJalaliDayKey(key, -7)) ?? 0,
    };
  });
  return summarize(points, todayIndex);
}

/** Last `count` Jalali months ending with this one, each against the same month a year earlier. */
export function monthsSpendSeries(
  transactions: Transaction[],
  todayKey: string,
  count = 6,
): SpendSeries {
  const byMonth = new Map<string, number>();
  for (const [day, rial] of expenseByDay(transactions)) {
    const month = day.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + rial);
  }
  const [year, month] = todayKey.split('-').map(Number);
  const points: SpendPoint[] = [];
  for (let back = count - 1; back >= 0; back -= 1) {
    const absolute = year * 12 + (month - 1) - back;
    const y = Math.floor(absolute / 12);
    const m = (absolute % 12) + 1;
    const key = `${y}-${String(m).padStart(2, '0')}`;
    const prevKey = `${y - 1}-${String(m).padStart(2, '0')}`;
    points.push({
      label: JALALI_MONTHS[m - 1],
      sub: '',
      name: `${JALALI_MONTHS[m - 1]} ${y}`,
      current: byMonth.get(key) ?? 0,
      previous: byMonth.get(prevKey) ?? 0,
    });
  }
  return summarize(points, count - 1);
}

function summarize(points: SpendPoint[], todayIndex: number): SpendSeries {
  let currentTotal = 0;
  let previousToDate = 0;
  points.forEach((p, i) => {
    currentTotal += p.current ?? 0;
    if (i <= todayIndex) {
      previousToDate += p.previous;
    }
  });
  return { points, todayIndex, currentTotal, previousToDate };
}
