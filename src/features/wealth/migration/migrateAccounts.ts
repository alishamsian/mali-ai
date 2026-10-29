import { summarizeWealth } from '../engine/portfolio';
import type { FinancialAccount, AssetId } from '../../../types/finance';
import type {
  AssetClass,
  AssetDetails,
  AssetLiquidity,
  NetWorthSnapshot,
} from '../../../types/wealth';
import type { FinanceSnapshot } from '../../../database/schema/snapshot';
import { SCHEMA_VERSION } from '../../../database/schema/snapshot';

const LEGACY_ASSET_MAP: Record<
  AssetId,
  { assetClass: AssetClass; buildDetails: (a: FinancialAccount) => AssetDetails }
> = {
  gold_gram: {
    assetClass: 'gold',
    buildDetails: a => ({
      class: 'gold',
      goldType: 'karat18',
      weight: a.quantity ?? 0,
      unit: 'gram',
      purity: 750,
      purchasePriceRial: a.costBasisRial ?? a.balanceRial,
      currentPricePerUnitRial: a.unitPriceRial ?? 0,
    }),
  },
  gold_coin: {
    assetClass: 'gold',
    buildDetails: a => ({
      class: 'gold',
      goldType: 'emami',
      weight: a.quantity ?? 1,
      unit: 'coin',
      purchasePriceRial: a.costBasisRial ?? a.balanceRial,
      currentPricePerUnitRial: a.unitPriceRial ?? a.balanceRial,
    }),
  },
  silver: {
    assetClass: 'silver',
    buildDetails: a => ({
      class: 'silver',
      silverType: 'raw',
      weight: a.quantity ?? 0,
      unit: 'gram',
      purity: 999,
      purchasePriceRial: a.costBasisRial ?? a.balanceRial,
      currentPricePerUnitRial: a.unitPriceRial ?? 0,
    }),
  },
  usd: {
    assetClass: 'currency',
    buildDetails: a => ({
      class: 'currency',
      currencyCode: 'USD',
      amount: a.quantity ?? 0,
      averagePurchaseRateRial: a.unitPriceRial ?? 0,
      currentRateRial: a.unitPriceRial ?? 0,
    }),
  },
  eur: {
    assetClass: 'currency',
    buildDetails: a => ({
      class: 'currency',
      currencyCode: 'EUR',
      amount: a.quantity ?? 0,
      averagePurchaseRateRial: a.unitPriceRial ?? 0,
      currentRateRial: a.unitPriceRial ?? 0,
    }),
  },
  usdt: {
    assetClass: 'crypto',
    buildDetails: a => ({
      class: 'crypto',
      symbol: 'USDT',
      name: 'Tether',
      quantity: a.quantity ?? 0,
      averageBuyPriceRial: a.unitPriceRial ?? 0,
      currentPriceRial: a.unitPriceRial ?? 0,
    }),
  },
  crypto: {
    assetClass: 'crypto',
    buildDetails: a => ({
      class: 'crypto',
      symbol: 'CRYPTO',
      name: a.name || 'Crypto',
      quantity: a.quantity ?? 0,
      averageBuyPriceRial: a.unitPriceRial ?? 0,
      currentPriceRial: a.unitPriceRial ?? 0,
    }),
  },
  other: {
    assetClass: 'other',
    buildDetails: a => ({
      class: 'other',
      purchaseValueRial: a.costBasisRial ?? a.balanceRial,
      currentValueRial: a.balanceRial,
    }),
  },
};

function defaultLiquidity(assetClass: AssetClass): AssetLiquidity {
  switch (assetClass) {
    case 'cash':
    case 'bank':
    case 'currency':
      return 'high';
    case 'gold':
    case 'silver':
    case 'crypto':
    case 'stock':
    case 'fund':
      return 'medium';
    default:
      return 'low';
  }
}

function migrateOne(account: FinancialAccount): FinancialAccount {
  if (account.assetClass && account.details) {
    return {
      ...account,
      liquidity: account.liquidity ?? defaultLiquidity(account.assetClass),
      priceSource: account.priceSource ?? 'manual',
      costBasisRial: account.costBasisRial ?? account.balanceRial,
      liabilityRial: account.liabilityRial ?? 0,
      valueHistory: account.valueHistory ?? [
        {
          date: account.updatedAt || account.createdAt,
          valueRial: account.balanceRial,
          source: 'manual',
        },
      ],
    };
  }

  if (account.kind === 'bank' || account.kind === 'card') {
    const details: AssetDetails = {
      class: 'bank',
      bankId: account.bankId,
      accountTitle: account.name,
      cardLast4: account.cardLast4,
      currency: 'IRT',
      accountType: 'checking',
    };
    return {
      ...account,
      assetClass: 'bank',
      details,
      liquidity: 'high',
      priceSource: 'manual',
      costBasisRial: account.balanceRial,
      liabilityRial: 0,
      valueHistory: account.valueHistory ?? [
        {
          date: account.updatedAt || account.createdAt,
          valueRial: account.balanceRial,
          source: 'manual',
        },
      ],
    };
  }

  if (account.kind === 'cash' || account.kind === 'wallet') {
    const details: AssetDetails = {
      class: 'cash',
      currency: 'IRT',
      amount: Math.round(account.balanceRial / 10),
      location: account.kind === 'wallet' ? 'wallet' : undefined,
    };
    return {
      ...account,
      assetClass: 'cash',
      details,
      liquidity: 'high',
      priceSource: 'manual',
      costBasisRial: account.balanceRial,
      liabilityRial: 0,
      valueHistory: account.valueHistory ?? [
        {
          date: account.updatedAt || account.createdAt,
          valueRial: account.balanceRial,
          source: 'manual',
        },
      ],
    };
  }

  if (account.kind === 'asset') {
    const legacy = account.assetId ? LEGACY_ASSET_MAP[account.assetId] : undefined;
    if (legacy) {
      const details = legacy.buildDetails(account);
      return {
        ...account,
        assetClass: legacy.assetClass,
        details,
        liquidity: defaultLiquidity(legacy.assetClass),
        priceSource: 'manual',
        costBasisRial: account.costBasisRial ?? account.balanceRial,
        liabilityRial: 0,
        valueHistory: account.valueHistory ?? [
          {
            date: account.updatedAt || account.createdAt,
            valueRial: account.balanceRial,
            source: 'manual',
          },
        ],
      };
    }
    const details: AssetDetails = {
      class: 'other',
      purchaseValueRial: account.costBasisRial ?? account.balanceRial,
      currentValueRial: account.balanceRial,
    };
    return {
      ...account,
      assetClass: 'other',
      details,
      liquidity: 'low',
      priceSource: 'manual',
      costBasisRial: account.costBasisRial ?? account.balanceRial,
      liabilityRial: 0,
      valueHistory: account.valueHistory ?? [
        {
          date: account.updatedAt || account.createdAt,
          valueRial: account.balanceRial,
          source: 'manual',
        },
      ],
    };
  }

  // Unknown kind → other (no data loss)
  return {
    ...account,
    assetClass: 'other',
    details: {
      class: 'other',
      purchaseValueRial: account.balanceRial,
      currentValueRial: account.balanceRial,
    },
    liquidity: 'low',
    priceSource: 'manual',
    costBasisRial: account.balanceRial,
    liabilityRial: 0,
  };
}

function ensureNetWorthHistory(snapshot: FinanceSnapshot): NetWorthSnapshot[] {
  const existing = snapshot.netWorthHistory ?? [];
  if (existing.length > 0) {
    return existing;
  }
  const assetsRial = snapshot.accounts.reduce((s, a) => s + (a.balanceRial ?? 0), 0);
  const liabilitiesRial = snapshot.accounts.reduce((s, a) => s + (a.liabilityRial ?? 0), 0);
  return [
    {
      date: new Date().toISOString(),
      assetsRial,
      liabilitiesRial,
      netWorthRial: assetsRial - liabilitiesRial,
    },
  ];
}

/**
 * Safe migration: never deletes accounts; fills wealth fields for legacy rows.
 */
export function migrateWealthSnapshot(snapshot: FinanceSnapshot): FinanceSnapshot {
  const accounts = snapshot.accounts.map(migrateOne);
  return {
    ...snapshot,
    version: SCHEMA_VERSION,
    accounts,
    netWorthHistory: ensureNetWorthHistory({ ...snapshot, accounts }),
  };
}

export function appendNetWorthPoint(snapshot: FinanceSnapshot): FinanceSnapshot {
  // Same figures as the Vault hero, so the chart and the headline agree.
  const summary = summarizeWealth(snapshot);
  const assetsRial = summary.totalAssetsRial;
  const liabilitiesRial = summary.totalLiabilitiesRial;
  const netWorthRial = summary.netWorthRial;
  const today = new Date().toISOString().slice(0, 10);
  const history = [...(snapshot.netWorthHistory ?? [])];
  const last = history[history.length - 1];
  if (last && last.date.slice(0, 10) === today) {
    history[history.length - 1] = {
      date: new Date().toISOString(),
      assetsRial,
      liabilitiesRial,
      netWorthRial,
    };
  } else {
    history.push({
      date: new Date().toISOString(),
      assetsRial,
      liabilitiesRial,
      netWorthRial,
    });
  }
  // Cap history growth
  const trimmed = history.length > 800 ? history.slice(history.length - 800) : history;
  return { ...snapshot, netWorthHistory: trimmed };
}
