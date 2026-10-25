import { migrateWealthSnapshot } from '../migration/migrateAccounts';
import { emptySnapshot } from '../../../database/schema/snapshot';
import {
  buildAllocation,
  holdingPerformance,
  revalueFromDetails,
  summarizePortfolio,
} from '../engine/portfolio';
import type { FinancialAccount } from '../../../types/finance';

function baseAccount(partial: Partial<FinancialAccount>): FinancialAccount {
  const now = new Date().toISOString();
  return {
    id: 'a1',
    userId: 'u1',
    kind: 'asset',
    name: 'test',
    balanceRial: 0,
    transactionCount: 0,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

describe('wealth migration', () => {
  it('migrates legacy gold_gram without data loss', () => {
    const snap = emptySnapshot();
    snap.version = 1;
    snap.accounts = [
      baseAccount({
        kind: 'asset',
        assetId: 'gold_gram',
        name: 'طلای من',
        quantity: 10,
        unitPriceRial: 75_000_000,
        balanceRial: 750_000_000,
      }),
    ];
    const next = migrateWealthSnapshot(snap);
    expect(next.version).toBe(2);
    expect(next.accounts[0].assetClass).toBe('gold');
    expect(next.accounts[0].details?.class).toBe('gold');
    expect(next.accounts[0].balanceRial).toBe(750_000_000);
    expect(next.accounts[0].name).toBe('طلای من');
    expect(next.netWorthHistory?.length).toBeGreaterThan(0);
  });

  it('migrates bank accounts for SMS compatibility', () => {
    const snap = emptySnapshot();
    snap.accounts = [
      baseAccount({
        kind: 'bank',
        bankId: 'mellat',
        cardLast4: '1234',
        balanceRial: 1_000_000,
        name: 'ملت',
      }),
    ];
    const next = migrateWealthSnapshot(snap);
    expect(next.accounts[0].assetClass).toBe('bank');
    expect(next.accounts[0].cardLast4).toBe('1234');
    expect(next.accounts[0].bankId).toBe('mellat');
  });
});

describe('wealth portfolio engine', () => {
  it('computes net worth = assets - liabilities', () => {
    const accounts = [
      baseAccount({
        id: '1',
        balanceRial: 1_000_000,
        liabilityRial: 200_000,
        assetClass: 'real_estate',
        costBasisRial: 800_000,
      }),
      baseAccount({
        id: '2',
        balanceRial: 500_000,
        liabilityRial: 0,
        assetClass: 'cash',
        costBasisRial: 500_000,
      }),
    ];
    const s = summarizePortfolio(accounts);
    expect(s.totalAssetsRial).toBe(1_500_000);
    expect(s.totalLiabilitiesRial).toBe(200_000);
    expect(s.netWorthRial).toBe(1_300_000);
  });

  it('revalues gold from details', () => {
    const account = baseAccount({
      assetClass: 'gold',
      details: {
        class: 'gold',
        goldType: 'karat18',
        weight: 10,
        unit: 'gram',
        purity: 750,
        purchasePriceRial: 600_000_000,
        currentPricePerUnitRial: 80_000_000,
      },
    });
    const valued = revalueFromDetails(account);
    expect(valued.balanceRial).toBe(800_000_000);
    expect(valued.costBasisRial).toBe(600_000_000);
    const perf = holdingPerformance(valued);
    expect(perf.unrealizedPlRial).toBe(200_000_000);
    expect(perf.supportsPl).toBe(true);
  });

  it('builds allocation percentages', () => {
    const accounts = [
      baseAccount({ id: 'g', balanceRial: 70, assetClass: 'gold', costBasisRial: 50 }),
      baseAccount({ id: 'c', balanceRial: 30, assetClass: 'cash', costBasisRial: 30 }),
    ];
    const slices = buildAllocation(accounts, 'all');
    expect(slices[0].assetClass).toBe('gold');
    expect(Math.round(slices[0].percent)).toBe(70);
  });
});
