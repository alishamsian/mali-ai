import { monthsSpendSeries, weekSpendSeries } from './spendSeries';
import type { Transaction } from '../../types/finance';

// In Jest the jalali calendar is stubbed to the gregorian day, so keys below are gregorian.
function spend(date: string, rial: number, extra: Partial<Transaction> = {}): Transaction {
  return {
    id: `${date}-${rial}`,
    userId: 'u',
    accountId: 'a',
    type: 'purchase',
    direction: 'out',
    amountRial: rial,
    currency: 'IRR',
    categoryId: 'food',
    transactionDate: `${date}T12:00:00`,
    source: 'manual',
    fingerprint: `${date}-${rial}`,
    confidence: 1,
    isConfirmed: true,
    needsReview: false,
    createdAt: `${date}T12:00:00`,
    updatedAt: `${date}T12:00:00`,
    ...extra,
  } as Transaction;
}

describe('weekSpendSeries', () => {
  // 2026-10-27 is a Tuesday → index 3 in a Saturday-first week.
  const today = '2026-10-27';

  it('places days on a Saturday-first week and leaves future days empty', () => {
    const s = weekSpendSeries([spend('2026-10-24', 100), spend('2026-10-27', 40)], today);
    expect(s.todayIndex).toBe(3);
    expect(s.points.map(p => p.current)).toEqual([100, 0, 0, 40, null, null, null]);
    expect(s.currentTotal).toBe(140);
  });

  it('compares with the same days of last week only up to today', () => {
    const s = weekSpendSeries(
      [spend('2026-10-17', 70), spend('2026-10-20', 30), spend('2026-10-23', 999)],
      today,
    );
    expect(s.points[0].previous).toBe(70);
    expect(s.points[3].previous).toBe(30);
    expect(s.previousToDate).toBe(100); // Friday's 999 is after "today" in last week
  });

  it('ignores income and transfers', () => {
    const s = weekSpendSeries(
      [spend('2026-10-27', 500, { direction: 'in', type: 'deposit' }), spend('2026-10-27', 50, { type: 'transfer', transferId: 'own' })],
      today,
    );
    expect(s.currentTotal).toBe(0);
  });
});

describe('monthsSpendSeries', () => {
  it('sums the last six months and the same months a year earlier', () => {
    const s = monthsSpendSeries(
      [spend('2026-10-03', 10), spend('2026-05-20', 5), spend('2025-10-09', 7), spend('2026-04-30', 99)],
      '2026-10-27',
    );
    expect(s.points).toHaveLength(6);
    expect(s.points[5].current).toBe(10);
    expect(s.points[5].previous).toBe(7);
    expect(s.points[0].current).toBe(5); // May is the first of six; April falls outside
    expect(s.todayIndex).toBe(5);
  });
});
