import type { Transaction } from '../../types/finance';
import { changeBreakdown, monthForecast } from './forecast';

// Jest's jalaliday stub is Gregorian: day 15 of a 30-day month.
const now = new Date('2026-11-15T08:30:00.000Z');
const DAY = 86_400_000;

function tx(id: string, amountRial: number, daysAgo: number, categoryId = 'food'): Transaction {
  const at = new Date(now.getTime() - daysAgo * DAY).toISOString();
  return {
    id, userId: 'u', accountId: 'a', type: 'purchase', direction: 'out', amountRial, currency: 'IRR',
    categoryId: categoryId as Transaction['categoryId'], transactionDate: at, source: 'manual',
    fingerprint: id, confidence: 1, isConfirmed: true, needsReview: false, createdAt: at, updatedAt: at,
  };
}

describe('monthForecast', () => {
  it('projects a steady pace to the month end and adds scheduled dues', () => {
    const daily = Array.from({ length: 80 }, (_, i) => tx(`d${i}`, 100_000, i + 0.1));
    const f = monthForecast(daily, now, 500_000);
    expect(f.day).toBe(15);
    expect(f.daysInMonth).toBe(30);
    // ~100k/day for 30 days plus the 500k due.
    expect(f.projectedRial).toBeGreaterThan(3_300_000);
    expect(f.projectedRial).toBeLessThan(3_700_000);
    expect(f.lowRial).toBeLessThanOrEqual(f.projectedRial);
    expect(f.highRial).toBeGreaterThanOrEqual(f.projectedRial);
  });

  it('does not extrapolate one big early payment across the month', () => {
    const history = Array.from({ length: 60 }, (_, i) => tx(`h${i}`, 100_000, 20 + i));
    const f = monthForecast([...history, tx('rent', 10_000_000, 13)], now);
    expect(f.projectedRial).toBeLessThan(20_000_000);
  });
});

describe('changeBreakdown', () => {
  it('explains the change by category, biggest first', () => {
    const b = changeBreakdown(
      [tx('a', 900_000, 2, 'food'), tx('b', 300_000, 32, 'food'), tx('c', 100_000, 3, 'transport'), tx('d', 400_000, 31.5, 'transport')],
      now,
    );
    expect(b.deltaRial).toBe(300_000);
    expect(b.rows.map(r => [r.id, r.deltaRial])).toEqual([['food', 600_000], ['transport', -300_000]]);
  });
});
