import type { FinancialAccount } from '../../../types/finance';
import type { GoldType } from '../../../types/wealth';
import { quoteFromBundle, type MarketBundle } from './marketClient';

/** نماد بازار برای نوع طلا */
export function goldMarketSymbol(goldType: GoldType): string {
  switch (goldType) {
    case 'emami':
      return 'gold_emami';
    case 'bahar':
      return 'gold_bahar';
    case 'half':
      return 'gold_half';
    case 'quarter':
      return 'gold_quarter';
    case 'grami':
      return 'gold_grami';
    case 'karat24':
      return 'gold_24';
    case 'melted':
    case 'karat18':
    case 'jewelry':
    case 'other':
    default:
      return 'gold_18';
  }
}

export function currencyMarketSymbol(code: string): string {
  return code.trim().toLowerCase();
}

export function cryptoMarketSymbol(symbol: string): string {
  return symbol.trim().toLowerCase().replace(/^usdt$/i, 'usdt');
}

/**
 * قیمت واحد به ریال برای یک دارایی، بر اساس جزئیات و باندل بازار.
 * طلای گرمی: ریال/گرم — سکه: ریال/قطعه — ارز: ریال به ازای ۱ واحد — کریپتو: ریال/کوین
 */
export function resolveUnitPriceRial(
  account: FinancialAccount,
  bundle: MarketBundle,
): number | null {
  const d = account.details;
  if (!d) {
    // legacy assetId
    if (account.assetId === 'gold_gram' || account.assetClass === 'gold') {
      return quoteFromBundle(bundle, 'gold_18');
    }
    if (account.assetId === 'usd' || account.assetClass === 'currency') {
      return quoteFromBundle(bundle, 'usd');
    }
    if (account.assetId === 'eur') {
      return quoteFromBundle(bundle, 'eur');
    }
    if (account.assetId === 'usdt' || account.assetClass === 'crypto') {
      return quoteFromBundle(bundle, 'usdt');
    }
    if (account.assetId === 'silver' || account.assetClass === 'silver') {
      return quoteFromBundle(bundle, 'silver_g');
    }
    return null;
  }

  switch (d.class) {
    case 'gold': {
      const sym = goldMarketSymbol(d.goldType);
      if (d.unit === 'mithqal') {
        return quoteFromBundle(bundle, 'gold_mesghal') ??
          (quoteFromBundle(bundle, 'gold_18') != null
            ? Math.round((quoteFromBundle(bundle, 'gold_18') as number) * 4.6083)
            : null);
      }
      // سکه / قطعه
      if (d.unit === 'coin' || d.unit === 'piece') {
        return quoteFromBundle(bundle, sym);
      }
      // گرم — برای سکه هم اگر اشتباهاً gram ثبت شده باشد همان قیمت سکه
      if (['emami', 'bahar', 'half', 'quarter', 'grami'].includes(d.goldType)) {
        return quoteFromBundle(bundle, sym);
      }
      return quoteFromBundle(bundle, sym);
    }
    case 'silver':
      return quoteFromBundle(bundle, 'silver_g');
    case 'currency':
      return quoteFromBundle(bundle, currencyMarketSymbol(d.currencyCode));
    case 'crypto':
      return quoteFromBundle(bundle, cryptoMarketSymbol(d.symbol));
    case 'cash': {
      const code = d.currency.toUpperCase();
      if (code === 'USD') {
        return quoteFromBundle(bundle, 'usd');
      }
      if (code === 'EUR') {
        return quoteFromBundle(bundle, 'eur');
      }
      if (code === 'GBP') {
        return quoteFromBundle(bundle, 'gbp');
      }
      if (code === 'AED') {
        return quoteFromBundle(bundle, 'aed');
      }
      return null;
    }
    default:
      return null;
  }
}

/** آیا این دارایی از بازار زنده پشتیبانی می‌شود؟ */
export function supportsLivePrice(account: FinancialAccount): boolean {
  const cls = account.assetClass ?? account.details?.class;
  return (
    cls === 'gold' ||
    cls === 'silver' ||
    cls === 'currency' ||
    cls === 'crypto' ||
    (cls === 'cash' &&
      !!account.details &&
      account.details.class === 'cash' &&
      ['USD', 'EUR', 'GBP', 'AED'].includes(account.details.currency.toUpperCase()))
  );
}
