import type { Transaction } from '../../types/finance';
import { spendHeatmap, topMerchants } from './habits';

const now = new Date('2026-11-15T08:30:00.000Z');

function tx(id: string, amountRial: number, at: string, merchant?: string): Transaction {
  return {
    id, userId: 'u', accountId: 'a', type: 'purchase', direction: 'out', amountRial, currency: 'IRR',
    categoryId: 'food', merchant, transactionDate: at, source: 'manual', fingerprint: id, confidence: 1,
    isConfirmed: true, needsReview: false, createdAt: at, updatedAt: at,
  };
}

describe('habits', () => {
  it('groups merchants case-insensitively and ranks by spend', () => {
    const rows = topMerchants(
      [
        tx('1', 100, '2026-11-10T10:00:00Z', 'Cafe'),
        tx('2', 300, '2026-11-12T10:00:00Z', 'cafe '),
        tx('3', 250, '2026-11-12T10:00:00Z', 'Market'),
        tx('4', 999, '2026-11-12T10:00:00Z'),
      ],
      now,
    );
    expect(rows.map(r => [r.name, r.count, r.totalRial, r.averageRial])).toEqual([
      ['Cafe', 2, 400, 200],
      ['Market', 1, 250, 250],
    ]);
  });

  it('finds the peak weekday and time band (Saturday first)', () => {
    // Friday 2026-11-13, 19:00 Tehran = 15:30 UTC.
    const map = spendHeatmap([tx('1', 500, '2026-11-13T15:30:00Z'), tx('2', 100, '2026-11-14T05:00:00Z')], now);
    expect(map.peak).toEqual({ weekday: 6, band: 2 });
    expect(map.maxRial).toBe(500);
  });
});
