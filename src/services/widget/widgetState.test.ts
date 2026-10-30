import { emptySnapshot } from '../../database/schema/snapshot';
import type { Transaction } from '../../types/finance';
import { buildWidgetState } from './widgetState';

const now = new Date('2026-11-15T08:30:00.000Z');
const spend = (id: string, amountRial: number, at = now.toISOString()): Transaction => ({
  id, userId: 'u', accountId: 'a', type: 'purchase', direction: 'out', amountRial, currency: 'IRR',
  categoryId: 'food', transactionDate: at, source: 'manual', fingerprint: id, confidence: 1,
  isConfirmed: true, needsReview: false, createdAt: at, updatedAt: at,
});

describe('buildWidgetState', () => {
  it('shows what is left for today against the month budget', () => {
    const base = emptySnapshot('u');
    const state = buildWidgetState(
      {
        ...base,
        settings: { ...base.settings, hideBalances: false },
        budgets: [{ id: 'b', userId: 'u', period: 'monthly', year: 2026, month: 11, totalLimitRial: 30_000_000, createdAt: '' }],
        transactions: [spend('t', 200_000)],
      },
      now,
    );
    expect(state.kicker).toBe('امروز می‌تونی خرج کنی');
    expect(state.progress).toBeGreaterThanOrEqual(0);
    expect(state.today).not.toBe('••••');
  });

  it('masks every amount when balances are hidden', () => {
    const base = emptySnapshot('u');
    const state = buildWidgetState({ ...base, settings: { ...base.settings, hideBalances: true }, transactions: [spend('t', 1_000)] }, now);
    expect(state.amount).toBe('••••');
  });
});
