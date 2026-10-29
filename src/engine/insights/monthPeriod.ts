import type { FinanceSnapshot } from '../../database/schema/snapshot';
import { withSettingsDefaults } from '../../features/settings/lib/settingsDefaults';
import { toJalaliYmd } from '../../utils/dates/jalali';
import type { Transaction, UserSettings } from '../../types/finance';

/** The only snapshot fields the month window reads (keeps memo dependencies exact). */
export type MonthWindowInput = Pick<FinanceSnapshot, 'transactions' | 'settings'>;

/** Day of the month (1-based) of a local date in some calendar. */
export type DayOfMonth = (date: Date) => number;

const gregorianDay: DayOfMonth = date => date.getDate();
const jalaliDay: DayOfMonth = date => toJalaliYmd(date.toISOString()).day;

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Local midnight of the first day of the calendar month containing `date`. */
function monthStartOf(date: Date, dayOfMonth: DayOfMonth): Date {
  // Noon keeps the calendar conversion away from midnight/timezone edges.
  const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  return addDays(noon, -(dayOfMonth(noon) - 1));
}

/**
 * Steps whole calendar months by walking day boundaries, so Jalali months (29–31 days)
 * are never approximated with Gregorian setMonth arithmetic.
 */
function shiftMonthStart(monthStart: Date, months: number, dayOfMonth: DayOfMonth): Date {
  let cursor = monthStart;
  for (let i = 0; i < Math.abs(months); i += 1) {
    // Every month has 29–31 days: +35 always lands inside the next month, -1 inside the previous.
    cursor = monthStartOf(addDays(cursor, months > 0 ? 35 : -1), dayOfMonth);
  }
  return cursor;
}

/**
 * Start (local midnight) of the financial month that contains `now`, shifted by
 * `offsetMonths`. A financial month runs from `startDay` of one calendar month to the
 * day before `startDay` of the next.
 */
export function financialPeriodStart(
  now: Date,
  startDay: number,
  offsetMonths: number,
  dayOfMonth: DayOfMonth,
): Date {
  let monthStart = monthStartOf(now, dayOfMonth);
  if (addDays(monthStart, startDay - 1).getTime() > now.getTime()) {
    monthStart = shiftMonthStart(monthStart, -1, dayOfMonth);
  }
  return addDays(shiftMonthStart(monthStart, offsetMonths, dayOfMonth), startDay - 1);
}

export function financialMonthStart(snapshot: MonthWindowInput, now = new Date(), offsetMonths = 0): Date {
  const settings = withSettingsDefaults(snapshot.settings);
  const startDay = Math.min(28, Math.max(1, settings.financialMonthStartDay ?? 1));
  const dayOfMonth = settings.calendar === 'gregorian' ? gregorianDay : jalaliDay;
  return financialPeriodStart(now, startDay, offsetMonths, dayOfMonth);
}

export function financialMonthTransactions(
  snapshot: MonthWindowInput,
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

const DAY_MS = 86_400_000;

export interface MonthWindow {
  start: Date;
  /** Start of the next financial month (exclusive end). */
  end: Date;
  /** Start of the previous financial month. */
  previousStart: Date;
  /** 1-based day of the financial month. */
  day: number;
  daysInMonth: number;
}

/**
 * The current financial month, honouring the user's start day and calendar. Budgets,
 * alerts, forecasts and Home all use this, so «this month» means the same everywhere.
 */
export function currentMonthWindow(
  settings: Pick<Partial<UserSettings>, 'financialMonthStartDay' | 'calendar'>,
  now = new Date(),
): MonthWindow {
  const startDay = Math.min(28, Math.max(1, settings.financialMonthStartDay ?? 1));
  const dayOfMonth = settings.calendar === 'gregorian' ? gregorianDay : jalaliDay;
  const at = (offset: number) => financialPeriodStart(now, startDay, offset, dayOfMonth);
  const start = at(0);
  const end = at(1);
  const previousStart = at(-1);
  return {
    start,
    end,
    previousStart,
    day: Math.floor((now.getTime() - start.getTime()) / DAY_MS) + 1,
    daysInMonth: Math.round((end.getTime() - start.getTime()) / DAY_MS),
  };
}
