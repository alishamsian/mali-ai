import { emptySnapshot } from '../../database/schema/snapshot';
import type { Transaction } from '../../types/finance';
import { financialMonthTransactions, financialPeriodStart, type DayOfMonth } from './monthPeriod';

/** Real first days of Jalali months, 1404 Esfand → 1405 Esfand (Gregorian Y, M, D). */
const JALALI_MONTH_STARTS = [
  [2026, 2, 20],
  [2026, 3, 21],
  [2026, 4, 21],
  [2026, 5, 22],
  [2026, 6, 22],
  [2026, 7, 23],
  [2026, 8, 23],
  [2026, 9, 23],
  [2026, 10, 23],
  [2026, 11, 22],
  [2026, 12, 22],
  [2027, 1, 21],
  [2027, 2, 20],
].map(([y, m, d]) => new Date(y, m - 1, d));

/** Jalali day-of-month from the table: Jest only has a Gregorian stub of jalaliday. */
const jalaliTableDay: DayOfMonth = date => {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const start = [...JALALI_MONTH_STARTS].reverse().find(s => s.getTime() <= day.getTime())!;
  return Math.round((day.getTime() - start.getTime()) / 864e5) + 1;
};

const gregorianDay: DayOfMonth = date => date.getDate();
const local = (y: number, m: number, d: number, h = 0) => new Date(y, m - 1, d, h);

describe('financialPeriodStart, Jalali', () => {
  const now = local(2026, 10, 27, 15); // 5 Aban 1405

  it('rolls back to the previous Jalali month by Jalali days, not a Gregorian month', () => {
    // 10 Aban is still ahead, so the period began on 10 Mehr = 2 Oct.
    // The old setMonth(-1) arithmetic landed on 1 Oct.
    expect(financialPeriodStart(now, 10, 0, jalaliTableDay)).toEqual(local(2026, 10, 2));
  });

  it('starts on the first of the current month when startDay is 1', () => {
    expect(financialPeriodStart(now, 1, 0, jalaliTableDay)).toEqual(local(2026, 10, 23));
  });

  it('includes today when today is the start day', () => {
    expect(financialPeriodStart(now, 5, 0, jalaliTableDay)).toEqual(local(2026, 10, 27));
  });

  it('steps whole Jalali months for offsets across 31- and 30-day months', () => {
    expect(financialPeriodStart(now, 1, -1, jalaliTableDay)).toEqual(local(2026, 9, 23));
    expect(financialPeriodStart(now, 1, -2, jalaliTableDay)).toEqual(local(2026, 8, 23));
    expect(financialPeriodStart(now, 1, 1, jalaliTableDay)).toEqual(local(2026, 11, 22));
    expect(financialPeriodStart(now, 28, -1, jalaliTableDay)).toEqual(local(2026, 9, 19));
  });

  it('crosses the Jalali year boundary', () => {
    expect(financialPeriodStart(local(2026, 3, 25), 1, -1, jalaliTableDay)).toEqual(
      local(2026, 2, 20),
    );
  });
});

describe('financialPeriodStart, Gregorian', () => {
  it('rolls back and offsets by Gregorian months', () => {
    const now = local(2026, 3, 10);
    expect(financialPeriodStart(now, 15, 0, gregorianDay)).toEqual(local(2026, 2, 15));
    expect(financialPeriodStart(now, 15, -1, gregorianDay)).toEqual(local(2026, 1, 15));
    expect(financialPeriodStart(now, 1, 0, gregorianDay)).toEqual(local(2026, 3, 1));
  });
});

describe('financialMonthTransactions', () => {
  it('excludes transactions dated after now', () => {
    const snapshot = emptySnapshot();
    snapshot.settings.calendar = 'gregorian';
    const tx = (id: string, date: Date) =>
      ({ id, transactionDate: date.toISOString() }) as Transaction;
    snapshot.transactions = [
      tx('before', local(2026, 2, 28)),
      tx('inside', local(2026, 3, 5)),
      tx('future', local(2026, 3, 20)),
    ];
    const ids = financialMonthTransactions(snapshot, 0, local(2026, 3, 10)).map(t => t.id);
    expect(ids).toEqual(['inside']);
  });
});
