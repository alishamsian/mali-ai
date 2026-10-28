import { emptySnapshot } from '../../database/schema/snapshot';
import type { Transaction } from '../../types/finance';
import { armedKey, buildSmartAlerts } from './smartAlerts';

const allOn = { transactions: true, assets: true, budgets: true, goals: true, system: true };
// Wednesday 2026-10-28, 10:00 Tehran.
const now = new Date('2026-10-28T06:30:00.000Z');

function tx(id: string, amountRial: number, daysAgo: number, categoryId = 'food'): Transaction {
  const at = new Date(now.getTime() - daysAgo * 86_400_000).toISOString();
  return {
    id,
    userId: 'u',
    accountId: 'a',
    type: 'purchase',
    direction: 'out',
    amountRial,
    currency: 'IRR',
    categoryId: categoryId as Transaction['categoryId'],
    merchant: 'shop',
    transactionDate: at,
    source: 'manual',
    fingerprint: id,
    confidence: 1,
    isConfirmed: true,
    needsReview: false,
    createdAt: at,
    updatedAt: at,
  };
}

function input(patch: Partial<ReturnType<typeof emptySnapshot>> = {}) {
  const base = emptySnapshot('u');
  return { ...base, settings: { ...base.settings, budgetAlertsEnabled: true }, ...patch };
}

describe('buildSmartAlerts', () => {
  it('warns at 80% and 100% of a category budget, once each', () => {
    const snap = input({
      transactions: [tx('t1', 900_000, 0)],
      budgetCategories: [{ id: 'b', budgetId: 'b', categoryId: 'food', limitRial: 1_000_000 } as never],
    });
    const near = buildSmartAlerts(snap, allOn, new Set(), now).filter(a => a.key.startsWith('budget:'));
    expect(near).toHaveLength(1);
    expect(near[0].key).toMatch(/:80$/);
    expect(buildSmartAlerts(snap, allOn, new Set([near[0].key]), now).some(a => a.key.startsWith('budget:'))).toBe(false);

    const over = buildSmartAlerts({ ...snap, transactions: [tx('t1', 1_200_000, 0)] }, allOn, new Set([near[0].key]), now);
    expect(over.find(a => a.key.startsWith('budget:'))?.key).toMatch(/:100$/);
  });

  it('flags only fresh anomalies', () => {
    const history = Array.from({ length: 6 }, (_, i) => tx(`h${i}`, 1_000_000 + i, 5 + i));
    const old = buildSmartAlerts(input({ transactions: [...history, tx('big_old', 9_000_000, 3)] }), allOn, new Set(), now);
    expect(old.some(a => a.key.startsWith('anomaly:'))).toBe(false);
    const fresh = buildSmartAlerts(input({ transactions: [...history, tx('big', 9_000_000, 0)] }), allOn, new Set(), now);
    expect(fresh.some(a => a.key === 'anomaly:big')).toBe(true);
  });

  it('arms due reminders for the day before and the due day at 9:00', () => {
    const cheque = {
      id: 'c1',
      direction: 'issued' as const,
      amountRial: 5_000_000,
      dueDate: '2026-11-02T08:00:00.000Z',
      counterparty: 'Ali',
      status: 'pending' as const,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    const due = buildSmartAlerts(input({ cheques: [cheque] }), allOn, new Set(), now).filter(a => a.key.startsWith('due:'));
    expect(due).toHaveLength(2);
    expect(due.every(a => a.at != null && new Date(a.at).getHours() === 9)).toBe(true);
    expect(buildSmartAlerts(input({ cheques: [cheque] }), { ...allOn, goals: false }, new Set(), now).some(a => a.key.startsWith('due:'))).toBe(false);
  });

  it('arms the Friday nudge before Friday evening and sends numbers after, unless the nudge went out', () => {
    const before = buildSmartAlerts(input(), allOn, new Set(), now).find(a => a.key.startsWith('weekly:'));
    expect(before?.at).toBeDefined();
    expect(new Date(before!.at!).getDay()).toBe(5);

    const fridayNight = new Date('2026-10-30T17:30:00.000Z'); // 21:00 Tehran
    const snap = input({ transactions: [tx('w', 3_000_000, -2)] });
    const after = buildSmartAlerts(snap, allOn, new Set(), fridayNight).find(a => a.key.startsWith('weekly:'));
    expect(after?.at).toBeUndefined();
    expect(after?.body).toContain('۳۰۰,۰۰۰');
    expect(
      buildSmartAlerts(snap, allOn, new Set([armedKey(before!.key)]), fridayNight).some(a => a.key.startsWith('weekly:')),
    ).toBe(false);
  });
});
