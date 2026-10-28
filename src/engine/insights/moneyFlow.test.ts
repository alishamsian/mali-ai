import type { Transaction } from '../../types/finance';
import { moneyFlow } from './moneyFlow';

function tx(id: string, direction: 'in' | 'out', amountRial: number, categoryId: string): Transaction {
  const at = '2026-11-10T10:00:00Z';
  return {
    id, userId: 'u', accountId: 'a', type: direction === 'in' ? 'deposit' : 'purchase', direction, amountRial,
    currency: 'IRR', categoryId: categoryId as Transaction['categoryId'], transactionDate: at, source: 'manual',
    fingerprint: id, confidence: 1, isConfirmed: true, needsReview: false, createdAt: at, updatedAt: at,
  };
}

describe('moneyFlow', () => {
  it('balances sources and sinks, adding savings', () => {
    const f = moneyFlow([tx('i', 'in', 1000, 'salary'), tx('a', 'out', 300, 'food'), tx('b', 'out', 200, 'transport')])!;
    const sum = (n: { rial: number }[]) => n.reduce((s, x) => s + x.rial, 0);
    expect(sum(f.sources)).toBe(1000);
    expect(sum(f.sinks)).toBe(1000);
    expect(f.sinks.find(n => n.id === 'savings')?.rial).toBe(500);
  });

  it('covers overspending from the balance and folds small categories into other', () => {
    const f = moneyFlow(
      [tx('i', 'in', 100, 'salary'), ...['food', 'transport', 'bills', 'health'].map((c, i) => tx(c, 'out', 100 - i, c))],
      2,
    )!;
    expect(f.sources.find(n => n.id === 'balance')?.rial).toBe(294);
    expect(f.sinks.map(n => n.id)).toEqual(['food', 'transport', 'other']);
  });
});
