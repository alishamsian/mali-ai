import type { Transaction } from '../../types/finance';
import { findBalanceGaps } from './balanceGaps';

const now = new Date('2026-11-15T08:30:00.000Z');
function sms(id: string, day: number, direction: 'in' | 'out', amountRial: number, balanceAfterRial: number): Transaction {
  const at = `2026-11-${String(day).padStart(2, '0')}T10:00:00.000Z`;
  return {
    id, userId: 'u', accountId: 'a', type: direction === 'in' ? 'deposit' : 'purchase', direction, amountRial,
    currency: 'IRR', categoryId: 'other', transactionDate: at, source: 'android_sms', fingerprint: id,
    confidence: 1, isConfirmed: true, needsReview: false, createdAt: at, updatedAt: at, balanceAfterRial,
  };
}

describe('findBalanceGaps', () => {
  it('finds money that moved between two SMS without its own message', () => {
    const gaps = findBalanceGaps(
      [sms('1', 1, 'in', 1_000_000, 5_000_000), sms('2', 3, 'out', 200_000, 4_800_000), sms('3', 5, 'out', 100_000, 4_200_000)],
      now,
    );
    expect(gaps).toEqual([{ accountId: 'a', gapRial: -500_000, fromDate: '2026-11-03T10:00:00.000Z', toDate: '2026-11-05T10:00:00.000Z' }]);
  });

  it('ignores a chain that adds up', () => {
    expect(findBalanceGaps([sms('1', 1, 'in', 1_000, 5_000), sms('2', 2, 'out', 1_000, 4_000)], now)).toEqual([]);
  });
});
