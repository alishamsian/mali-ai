import type { FinancialAccount } from '../../../types/finance';
import { allocationVsTarget, PRESETS } from '../engine/targets';

const acc = (
  id: string,
  assetClass: FinancialAccount['assetClass'],
  balanceRial: number,
): FinancialAccount => ({
  id,
  userId: 'u',
  kind: 'bank',
  name: id,
  balanceRial,
  transactionCount: 0,
  assetClass,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
});

describe('allocationVsTarget', () => {
  it('groups classes into buckets and measures drift from the target', () => {
    const rows = allocationVsTarget(
      [acc('b', 'bank', 600), acc('g', 'gold', 300), acc('c', 'crypto', 100)],
      PRESETS.balanced,
    );
    const by = Object.fromEntries(rows.map(r => [r.bucket, r]));
    expect(by.cash).toMatchObject({ currentPct: 60, targetPct: 25, driftPct: 35 });
    expect(by.gold.currentPct).toBe(30);
    expect(by.fx.currentPct).toBe(10);
    expect(by.equity.driftPct).toBe(-20);
  });
});
