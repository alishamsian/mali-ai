import type { PriceSourceKind } from '../../../types/wealth';
import type { FinancialAccount } from '../../../types/finance';
import { revalueFromDetails } from '../engine/portfolio';
import { getMarketBundle, quoteFromBundle, type MarketBundle } from './marketClient';
import { resolveUnitPriceRial, supportsLivePrice } from './symbols';

export type PriceQuote = {
  priceRial: number;
  asOf: string;
  source: PriceSourceKind;
  symbol: string;
};

export type HistoricalQuote = {
  date: string;
  priceRial: number;
};

/**
 * Abstraction for market prices. UI must never call external APIs directly.
 */
export interface AssetPriceProvider {
  readonly id: string;
  getCurrentPrice(symbol: string): Promise<PriceQuote | null>;
  getHistoricalPrices(symbol: string, days: number): Promise<HistoricalQuote[]>;
}

function quote(symbol: string, priceRial: number, source: PriceSourceKind = 'manual'): PriceQuote {
  return {
    symbol,
    priceRial,
    asOf: new Date().toISOString(),
    source,
  };
}

/** آخرین قیمت شناخته‌شده از خود دارایی‌ها (آفلاین) */
export class LastKnownPriceProvider implements AssetPriceProvider {
  constructor(public readonly id: string, private readonly accounts: FinancialAccount[]) {}

  async getCurrentPrice(symbol: string): Promise<PriceQuote | null> {
    const match = this.accounts.find(
      a =>
        a.assetId === symbol ||
        a.id === symbol ||
        a.name === symbol ||
        a.details?.class === this.id,
    );
    if (!match) {
      return null;
    }
    const price =
      match.unitPriceRial && match.unitPriceRial > 0
        ? match.unitPriceRial
        : match.balanceRial > 0 && (match.quantity ?? 0) > 0
        ? Math.round(match.balanceRial / (match.quantity as number))
        : 0;
    if (price <= 0) {
      return null;
    }
    return quote(symbol, price, match.priceSource ?? 'manual');
  }

  async getHistoricalPrices(symbol: string): Promise<HistoricalQuote[]> {
    const match = this.accounts.find(a => a.assetId === symbol || a.id === symbol);
    return (match?.valueHistory ?? []).map(p => ({
      date: p.date,
      priceRial: p.valueRial,
    }));
  }
}

/** ارائه‌دهنده زنده بازار (TGJU / Navasan / CoinGecko) */
export class LiveMarketPriceProvider implements AssetPriceProvider {
  constructor(public readonly id: string) {}

  async getCurrentPrice(symbol: string): Promise<PriceQuote | null> {
    try {
      const bundle = await getMarketBundle();
      const price = quoteFromBundle(bundle, symbol);
      if (price == null) {
        return null;
      }
      return {
        symbol,
        priceRial: price,
        asOf: bundle.asOf,
        source: 'provider',
      };
    } catch {
      return null;
    }
  }

  async getHistoricalPrices(): Promise<HistoricalQuote[]> {
    return [];
  }
}

export const GoldPriceProvider: AssetPriceProvider = new LiveMarketPriceProvider('gold');
export const SilverPriceProvider: AssetPriceProvider = new LiveMarketPriceProvider('silver');
export const CryptoPriceProvider: AssetPriceProvider = new LiveMarketPriceProvider('crypto');
export const CurrencyPriceProvider: AssetPriceProvider = new LiveMarketPriceProvider('currency');
export const StockPriceProvider: AssetPriceProvider = new LiveMarketPriceProvider('stock');

export function providerForClass(assetClass: string): AssetPriceProvider {
  switch (assetClass) {
    case 'gold':
      return GoldPriceProvider;
    case 'silver':
      return SilverPriceProvider;
    case 'crypto':
      return CryptoPriceProvider;
    case 'currency':
      return CurrencyPriceProvider;
    case 'stock':
    case 'fund':
      return StockPriceProvider;
    default:
      return new LiveMarketPriceProvider(assetClass);
  }
}

function applyQuoteToAccount(
  account: FinancialAccount,
  unitPriceRial: number,
  asOf: string,
): FinancialAccount {
  const now = asOf;
  let next: FinancialAccount = {
    ...account,
    unitPriceRial,
    priceSource: 'provider',
    priceUpdatedAt: now,
    updatedAt: now,
  };

  const d = account.details;
  if (d?.class === 'gold') {
    next = {
      ...next,
      details: { ...d, currentPricePerUnitRial: unitPriceRial },
      quantity: d.weight,
    };
  } else if (d?.class === 'silver') {
    next = {
      ...next,
      details: { ...d, currentPricePerUnitRial: unitPriceRial },
      quantity: d.weight,
    };
  } else if (d?.class === 'currency') {
    next = {
      ...next,
      details: { ...d, currentRateRial: unitPriceRial },
      quantity: d.amount,
    };
  } else if (d?.class === 'crypto') {
    next = {
      ...next,
      details: { ...d, currentPriceRial: unitPriceRial },
      quantity: d.quantity,
    };
  } else if (
    d?.class === 'cash' &&
    ['USD', 'EUR', 'GBP', 'AED'].includes(d.currency.toUpperCase())
  ) {
    next = {
      ...next,
      balanceRial: Math.round(d.amount * unitPriceRial),
      costBasisRial: Math.round(d.amount * unitPriceRial),
      quantity: d.amount,
    };
    const history = [...(next.valueHistory ?? [])];
    const last = history[history.length - 1];
    if (!last || last.valueRial !== next.balanceRial) {
      history.push({ date: now, valueRial: next.balanceRial, source: 'provider' });
    }
    return {
      ...next,
      valueHistory: history.length > 120 ? history.slice(history.length - 120) : history,
    };
  }

  next = revalueFromDetails(next);

  const history = [...(next.valueHistory ?? [])];
  const last = history[history.length - 1];
  if (!last || last.valueRial !== next.balanceRial) {
    history.push({ date: now, valueRial: next.balanceRial, source: 'provider' });
  }
  return {
    ...next,
    valueHistory: history.length > 120 ? history.slice(history.length - 120) : history,
  };
}

/** به‌روزرسانی همهٔ دارایی‌های قابل‌نرخ از بازار زنده */
export async function refreshPricesFromHoldings(
  accounts: FinancialAccount[],
  options?: { force?: boolean },
): Promise<{ accounts: FinancialAccount[]; updated: number; bundle: MarketBundle | null }> {
  let bundle: MarketBundle | null = null;
  try {
    bundle = await getMarketBundle(Boolean(options?.force));
  } catch {
    return { accounts, updated: 0, bundle: null };
  }

  let updated = 0;
  const next = accounts.map(a => {
    if (!supportsLivePrice(a)) {
      return a;
    }
    const unit = resolveUnitPriceRial(a, bundle as MarketBundle);
    if (unit == null || unit <= 0) {
      return a;
    }
    // اگر قیمت تغییر نکرده، آبجکت را عوض نکن
    const prevUnit =
      a.unitPriceRial ??
      (a.details?.class === 'gold'
        ? a.details.currentPricePerUnitRial
        : a.details?.class === 'currency'
        ? a.details.currentRateRial
        : a.details?.class === 'crypto'
        ? a.details.currentPriceRial
        : 0);
    const valued = applyQuoteToAccount(a, unit, (bundle as MarketBundle).asOf);
    if (valued.balanceRial !== a.balanceRial || unit !== prevUnit) {
      updated += 1;
      return valued;
    }
    return a;
  });

  return { accounts: next, updated, bundle };
}

/** قیمت لحظه‌ای یک نماد برای UI افزودن دارایی */
export async function fetchLiveUnitPrice(symbol: string): Promise<PriceQuote | null> {
  return new LiveMarketPriceProvider('live').getCurrentPrice(symbol);
}
