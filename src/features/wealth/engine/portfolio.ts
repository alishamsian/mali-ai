import type { FinancialAccount } from '../../../types/finance';
import type {
  AllocationFilter,
  AssetClass,
  AssetLiquidity,
  HoldingPerformance,
  WealthRange,
  NetWorthSnapshot,
} from '../../../types/wealth';
import { resolveAssetClass } from '../catalog/classes';
import type { FinanceSnapshot } from '../../../database/schema/snapshot';
import { obligationsPosition } from '../../../engine/obligations/dues';

export function holdingPerformance(account: FinancialAccount): HoldingPerformance {
  const currentValueRial = account.balanceRial;
  const liabilityRial = account.liabilityRial ?? 0;
  const costBasisRial = account.costBasisRial ?? currentValueRial;
  const supportsPl = !['cash', 'bank'].includes(resolveAssetClass(account));
  const unrealizedPlRial = supportsPl ? currentValueRial - costBasisRial : 0;
  const unrealizedPlPct =
    supportsPl && costBasisRial > 0 ? (unrealizedPlRial / costBasisRial) * 100 : null;
  return {
    costBasisRial,
    currentValueRial,
    liabilityRial,
    netValueRial: currentValueRial - liabilityRial,
    unrealizedPlRial,
    unrealizedPlPct,
    supportsPl,
  };
}

export type PortfolioSummary = {
  totalAssetsRial: number;
  totalLiabilitiesRial: number;
  netWorthRial: number;
  costBasisRial: number;
  unrealizedPlRial: number;
  unrealizedPlPct: number | null;
  liquidRial: number;
  illiquidRial: number;
};

export function summarizePortfolio(accounts: FinancialAccount[]): PortfolioSummary {
  let totalAssetsRial = 0;
  let totalLiabilitiesRial = 0;
  let costBasisRial = 0;
  let unrealizedPlRial = 0;
  let liquidRial = 0;
  let illiquidRial = 0;

  for (const a of accounts) {
    const perf = holdingPerformance(a);
    totalAssetsRial += perf.currentValueRial;
    totalLiabilitiesRial += perf.liabilityRial;
    costBasisRial += perf.costBasisRial;
    if (perf.supportsPl) {
      unrealizedPlRial += perf.unrealizedPlRial;
    }
    const liq = a.liquidity ?? 'medium';
    if (liq === 'high' || liq === 'medium') {
      liquidRial += perf.netValueRial;
    } else {
      illiquidRial += perf.netValueRial;
    }
  }

  const netWorthRial = totalAssetsRial - totalLiabilitiesRial;
  const unrealizedPlPct = costBasisRial > 0 ? (unrealizedPlRial / costBasisRial) * 100 : null;

  return {
    totalAssetsRial,
    totalLiabilitiesRial,
    netWorthRial,
    costBasisRial,
    unrealizedPlRial,
    unrealizedPlPct,
    liquidRial,
    illiquidRial,
  };
}

export type AllocationSlice = {
  assetClass: AssetClass;
  valueRial: number;
  percent: number;
  count: number;
  unrealizedPlRial: number;
};

const INVESTMENT: AssetClass[] = [
  'gold',
  'silver',
  'currency',
  'crypto',
  'stock',
  'fund',
  'business',
];
const LIQUID: AssetClass[] = ['cash', 'bank', 'currency', 'crypto', 'stock', 'fund'];
const PHYSICAL: AssetClass[] = [
  'gold',
  'silver',
  'real_estate',
  'vehicle',
  'jewelry',
  'collectible',
];
const ALTERNATIVE: AssetClass[] = ['collectible', 'business', 'jewelry', 'other'];

export function matchesAllocationFilter(assetClass: AssetClass, filter: AllocationFilter): boolean {
  if (filter === 'all') {
    return true;
  }
  if (filter === 'investments') {
    return INVESTMENT.includes(assetClass);
  }
  if (filter === 'liquid') {
    return LIQUID.includes(assetClass);
  }
  if (filter === 'physical') {
    return PHYSICAL.includes(assetClass);
  }
  return ALTERNATIVE.includes(assetClass);
}

export function buildAllocation(
  accounts: FinancialAccount[],
  filter: AllocationFilter = 'all',
): AllocationSlice[] {
  const map = new Map<AssetClass, AllocationSlice>();
  for (const a of accounts) {
    const cls = resolveAssetClass(a);
    if (!matchesAllocationFilter(cls, filter)) {
      continue;
    }
    const perf = holdingPerformance(a);
    const existing = map.get(cls);
    if (existing) {
      existing.valueRial += perf.netValueRial;
      existing.count += 1;
      existing.unrealizedPlRial += perf.supportsPl ? perf.unrealizedPlRial : 0;
    } else {
      map.set(cls, {
        assetClass: cls,
        valueRial: perf.netValueRial,
        percent: 0,
        count: 1,
        unrealizedPlRial: perf.supportsPl ? perf.unrealizedPlRial : 0,
      });
    }
  }
  const slices = [...map.values()].filter(s => s.valueRial > 0);
  const total = slices.reduce((s, x) => s + x.valueRial, 0) || 1;
  for (const s of slices) {
    s.percent = (s.valueRial / total) * 100;
  }
  return slices.sort((a, b) => b.valueRial - a.valueRial);
}

const RANGE_DAYS: Record<Exclude<WealthRange, 'ALL'>, number> = {
  '1D': 1,
  '1W': 7,
  '1M': 30,
  '3M': 90,
  '6M': 180,
  '1Y': 365,
};

export function filterNetWorthHistory(
  history: NetWorthSnapshot[],
  range: WealthRange,
): NetWorthSnapshot[] {
  if (range === 'ALL' || history.length === 0) {
    return history;
  }
  const days = RANGE_DAYS[range];
  const cutoff = Date.now() - days * 86_400_000;
  const filtered = history.filter(h => new Date(h.date).getTime() >= cutoff);
  return filtered.length >= 2 ? filtered : history.slice(-Math.min(history.length, 2));
}

export function netWorthChangePct(history: NetWorthSnapshot[]): number | null {
  if (history.length < 2) {
    return null;
  }
  const first = history[0].netWorthRial;
  const last = history[history.length - 1].netWorthRial;
  if (first === 0) {
    return null;
  }
  return ((last - first) / Math.abs(first)) * 100;
}

export type WealthSort = 'value' | 'profit' | 'profit_pct' | 'updated' | 'name';

export type WealthListFilter = {
  query?: string;
  assetClass?: AssetClass | 'all';
  liquidity?: AssetLiquidity | 'all';
  allocation?: AllocationFilter;
};

export function filterAndSortHoldings(
  accounts: FinancialAccount[],
  opts: WealthListFilter & { sort: WealthSort },
): FinancialAccount[] {
  let list = [...accounts];
  if (opts.query?.trim()) {
    const q = opts.query.trim().toLowerCase();
    list = list.filter(a => a.name.toLowerCase().includes(q));
  }
  if (opts.assetClass && opts.assetClass !== 'all') {
    list = list.filter(a => resolveAssetClass(a) === opts.assetClass);
  }
  if (opts.liquidity && opts.liquidity !== 'all') {
    list = list.filter(a => (a.liquidity ?? 'medium') === opts.liquidity);
  }
  if (opts.allocation && opts.allocation !== 'all') {
    list = list.filter(a => matchesAllocationFilter(resolveAssetClass(a), opts.allocation!));
  }

  list.sort((a, b) => {
    const pa = holdingPerformance(a);
    const pb = holdingPerformance(b);
    switch (opts.sort) {
      case 'name':
        return a.name.localeCompare(b.name, 'fa');
      case 'updated':
        return b.updatedAt.localeCompare(a.updatedAt);
      case 'profit':
        return pb.unrealizedPlRial - pa.unrealizedPlRial;
      case 'profit_pct':
        return (pb.unrealizedPlPct ?? -Infinity) - (pa.unrealizedPlPct ?? -Infinity);
      case 'value':
      default:
        return pb.netValueRial - pa.netValueRial;
    }
  });
  return list;
}

/** Recompute balanceRial / costBasis from typed details when possible */
export function revalueFromDetails(account: FinancialAccount): FinancialAccount {
  const d = account.details;
  if (!d) {
    return account;
  }
  let balanceRial = account.balanceRial;
  let costBasisRial = account.costBasisRial ?? account.balanceRial;
  let liabilityRial = account.liabilityRial ?? 0;

  switch (d.class) {
    case 'cash':
      if (d.currency === 'IRT') {
        balanceRial = Math.round(d.amount * 10);
        costBasisRial = balanceRial;
      } else if (d.currency === 'IRR') {
        balanceRial = Math.round(d.amount);
        costBasisRial = balanceRial;
      } else if (d.rateRial && d.rateRial > 0) {
        balanceRial = Math.round(d.amount * d.rateRial);
        costBasisRial = balanceRial;
      }
      break;
    case 'bank':
      costBasisRial = account.balanceRial;
      break;
    case 'gold': {
      const units =
        d.unit === 'mithqal'
          ? d.weight * 4.6083
          : d.unit === 'coin' || d.unit === 'piece'
          ? d.weight
          : d.weight;
      balanceRial = Math.round(units * d.currentPricePerUnitRial);
      costBasisRial = d.purchasePriceRial;
      break;
    }
    case 'silver': {
      let grams = d.weight;
      if (d.unit === 'kilogram') {
        grams = d.weight * 1000;
      } else if (d.unit === 'ounce') {
        grams = d.weight * 31.1035;
      }
      balanceRial = Math.round(grams * d.currentPricePerUnitRial);
      costBasisRial = d.purchasePriceRial;
      break;
    }
    case 'currency':
      balanceRial = Math.round(d.amount * d.currentRateRial);
      costBasisRial = Math.round(d.amount * d.averagePurchaseRateRial);
      break;
    case 'crypto':
      balanceRial = Math.round(d.quantity * d.currentPriceRial);
      costBasisRial = Math.round(d.quantity * d.averageBuyPriceRial);
      break;
    case 'stock':
      balanceRial = Math.round(d.quantity * d.currentPriceRial);
      costBasisRial = Math.round(d.quantity * d.averagePurchasePriceRial);
      break;
    case 'fund':
      balanceRial = Math.round(d.units * d.currentNavRial);
      costBasisRial = Math.round(d.units * d.purchaseNavRial);
      break;
    case 'real_estate':
      balanceRial = Math.round(d.estimatedValueRial * (d.ownershipPercent / 100));
      costBasisRial = Math.round(d.purchasePriceRial * (d.ownershipPercent / 100));
      liabilityRial = Math.round((d.mortgageRial ?? 0) * (d.ownershipPercent / 100));
      break;
    case 'vehicle':
      balanceRial = Math.round(d.estimatedValueRial * (d.ownershipPercent / 100));
      costBasisRial = Math.round(d.purchasePriceRial * (d.ownershipPercent / 100));
      liabilityRial = Math.round((d.loanRial ?? 0) * (d.ownershipPercent / 100));
      break;
    case 'jewelry':
      balanceRial = d.estimatedValueRial;
      costBasisRial = d.purchasePriceRial;
      break;
    case 'collectible':
      balanceRial = d.estimatedValueRial;
      costBasisRial = d.purchasePriceRial;
      break;
    case 'business':
      balanceRial = Math.round(d.estimatedBusinessValueRial * (d.ownershipPercent / 100));
      costBasisRial = d.investmentAmountRial;
      break;
    case 'other':
      balanceRial = d.currentValueRial;
      costBasisRial = d.purchaseValueRial;
      break;
  }

  return {
    ...account,
    balanceRial,
    costBasisRial,
    liabilityRial,
    priceUpdatedAt: new Date().toISOString(),
  };
}

/**
 * Portfolio summary with the cheques/installments/debts section folded in: unpaid
 * installments, borrowed money and issued cheques are liabilities; money lent and
 * received cheques are assets.
 */
export function summarizeWealth(
  snapshot: Pick<
    FinanceSnapshot,
    'accounts' | 'installmentPlans' | 'cheques' | 'debts' | 'settings'
  >,
  now = new Date(),
): PortfolioSummary {
  const base = summarizePortfolio(snapshot.accounts);
  const { owedRial, owedToMeRial } = obligationsPosition(
    {
      plans: snapshot.installmentPlans ?? [],
      cheques: snapshot.cheques ?? [],
      debts: snapshot.debts ?? [],
    },
    now,
    snapshot.settings.calendar ?? 'jalali',
  );
  const totalAssetsRial = base.totalAssetsRial + owedToMeRial;
  const totalLiabilitiesRial = base.totalLiabilitiesRial + owedRial;
  return {
    ...base,
    totalAssetsRial,
    totalLiabilitiesRial,
    netWorthRial: totalAssetsRial - totalLiabilitiesRial,
  };
}
