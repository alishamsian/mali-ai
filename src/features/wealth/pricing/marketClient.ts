/**
 * کلاینت نرخ بازار ایران.
 * منبع اصلی: TGJU (ریال) — پشتیبان: Navasan mirror (تومان → ×۱۰ ریال)
 * کریپتو: CoinGecko USD × نرخ دلار TGJU
 */

import { secureMarketFetchJson } from '../../../services/security/secureFetch';

export type MarketQuoteMap = Record<string, number>;

export type MarketBundle = {
  asOf: string;
  source: 'tgju' | 'navasan' | 'mixed';
  /** قیمت واحد به ریال — کلیدهای نرمال‌شده */
  quotes: MarketQuoteMap;
};

const TGJU_URL = 'https://call1.tgju.org/ajax.json';
const NAVASAN_GOLD =
  'https://raw.githubusercontent.com/HosseinOdd/Navasan-API/main/data/gold.json';
const NAVASAN_FIAT =
  'https://raw.githubusercontent.com/HosseinOdd/Navasan-API/main/data/fiat.json';
const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether,binancecoin,solana,ripple,tron,dogecoin&vs_currencies=usd';

const CACHE_TTL_MS = 45_000;
let cache: { at: number; bundle: MarketBundle } | null = null;
let inflight: Promise<MarketBundle> | null = null;

function parseNumber(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return raw;
  }
  if (typeof raw !== 'string') {
    return null;
  }
  const cleaned = raw.replace(/[^\d.]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function fetchJson(url: string, ms = 12_000): Promise<unknown> {
  return secureMarketFetchJson(url, ms);
}

/** کلیدهای TGJU → نماد داخلی (همه به ریال) */
const TGJU_KEY_MAP: Record<string, string> = {
  geram18: 'gold_18',
  geram24: 'gold_24',
  mesghal: 'gold_mesghal',
  sekee: 'gold_emami',
  sekee_down: 'gold_bahar',
  nim: 'gold_half',
  rob: 'gold_quarter',
  gerami: 'gold_grami',
  silver_999: 'silver_g',
  price_dollar_rl: 'usd',
  price_dollar_dt: 'usd',
  price_eur: 'eur',
  price_gbp: 'gbp',
  price_aed: 'aed',
};

/** Navasan طلا (تومان) */
const NAVASAN_GOLD_MAP: Record<string, string> = {
  '18ayar': 'gold_18',
  sekkeh: 'gold_emami',
  bahar: 'gold_bahar',
  nim: 'gold_half',
  rob: 'gold_quarter',
  gerami: 'gold_grami',
  mesghal: 'gold_mesghal',
};

const NAVASAN_FIAT_MAP: Record<string, string> = {
  usd: 'usd',
  eur: 'eur',
  gbp: 'gbp',
  aed: 'aed',
  try: 'try',
  cad: 'cad',
  aud: 'aud',
  cny: 'cny',
};

const COINGECKO_MAP: Record<string, string> = {
  bitcoin: 'btc',
  ethereum: 'eth',
  tether: 'usdt',
  binancecoin: 'bnb',
  solana: 'sol',
  ripple: 'xrp',
  tron: 'trx',
  dogecoin: 'doge',
};

function parseTgju(raw: unknown): MarketQuoteMap {
  const out: MarketQuoteMap = {};
  const current =
    raw && typeof raw === 'object' && 'current' in raw
      ? (raw as { current: Record<string, { p?: string }> }).current
      : null;
  if (!current) {
    return out;
  }
  for (const [tgKey, symbol] of Object.entries(TGJU_KEY_MAP)) {
    const row = current[tgKey];
    const n = parseNumber(row?.p);
    if (n != null) {
      out[symbol] = n;
    }
  }
  return out;
}

function parseNavasanGold(raw: unknown): MarketQuoteMap {
  const out: MarketQuoteMap = {};
  if (!raw || typeof raw !== 'object') {
    return out;
  }
  for (const [k, symbol] of Object.entries(NAVASAN_GOLD_MAP)) {
    const row = (raw as Record<string, { value?: number | string }>)[k];
    const toman = parseNumber(row?.value);
    if (toman != null) {
      out[symbol] = Math.round(toman * 10); // تومان → ریال
    }
  }
  return out;
}

function parseNavasanFiat(raw: unknown): MarketQuoteMap {
  const out: MarketQuoteMap = {};
  if (!raw || typeof raw !== 'object') {
    return out;
  }
  for (const [k, symbol] of Object.entries(NAVASAN_FIAT_MAP)) {
    const row = (raw as Record<string, { value?: number | string }>)[k];
    const toman = parseNumber(row?.value);
    if (toman != null) {
      out[symbol] = Math.round(toman * 10);
    }
  }
  return out;
}

function mergeQuotes(...maps: MarketQuoteMap[]): MarketQuoteMap {
  const out: MarketQuoteMap = {};
  for (const m of maps) {
    for (const [k, v] of Object.entries(m)) {
      if (v > 0 && out[k] == null) {
        out[k] = v;
      }
    }
  }
  return out;
}

async function fetchCryptoInRial(usdRial: number): Promise<MarketQuoteMap> {
  if (usdRial <= 0) {
    return {};
  }
  try {
    const raw = await fetchJson(COINGECKO_URL);
    if (!raw || typeof raw !== 'object') {
      return {};
    }
    const out: MarketQuoteMap = {};
    for (const [id, symbol] of Object.entries(COINGECKO_MAP)) {
      const usd = parseNumber((raw as Record<string, { usd?: number }>)[id]?.usd);
      if (usd != null) {
        out[symbol] = Math.round(usd * usdRial);
      }
    }
    // USDT ≈ ۱ دلار بازار آزاد
    if (out.usdt == null) {
      out.usdt = usdRial;
    }
    return out;
  } catch {
    return { usdt: usdRial };
  }
}

async function loadFreshBundle(): Promise<MarketBundle> {
  let tgju: MarketQuoteMap = {};
  let navasan: MarketQuoteMap = {};
  let source: MarketBundle['source'] = 'tgju';

  try {
    tgju = parseTgju(await fetchJson(TGJU_URL));
  } catch {
    tgju = {};
  }

  if (Object.keys(tgju).length < 3) {
    try {
      const [g, f] = await Promise.all([fetchJson(NAVASAN_GOLD), fetchJson(NAVASAN_FIAT)]);
      navasan = mergeQuotes(parseNavasanGold(g), parseNavasanFiat(f));
      source = Object.keys(tgju).length ? 'mixed' : 'navasan';
    } catch {
      if (!Object.keys(tgju).length) {
        throw new Error('market_unavailable');
      }
      source = 'tgju';
    }
  }

  const base = mergeQuotes(tgju, navasan);
  const usd = base.usd ?? 0;
  const crypto = await fetchCryptoInRial(usd);
  const quotes = mergeQuotes(base, crypto);

  if (!Object.keys(quotes).length) {
    throw new Error('market_empty');
  }

  // مشتق طلای ۲۴ از ۱۸ اگر نبود
  if (quotes.gold_24 == null && quotes.gold_18 != null) {
    quotes.gold_24 = Math.round((quotes.gold_18 * 999) / 750);
  }
  if (quotes.gold_mesghal == null && quotes.gold_18 != null) {
    quotes.gold_mesghal = Math.round(quotes.gold_18 * 4.6083);
  }

  return {
    asOf: new Date().toISOString(),
    source,
    quotes,
  };
}

/** باندل نرخ با کش کوتاه‌مدت */
export async function getMarketBundle(force = false): Promise<MarketBundle> {
  const now = Date.now();
  if (!force && cache && now - cache.at < CACHE_TTL_MS) {
    return cache.bundle;
  }
  if (!force && inflight) {
    return inflight;
  }
  inflight = loadFreshBundle()
    .then(bundle => {
      cache = { at: Date.now(), bundle };
      return bundle;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** فقط برای تست */
export function __resetMarketCacheForTests(): void {
  cache = null;
  inflight = null;
}

export function quoteFromBundle(bundle: MarketBundle, symbol: string): number | null {
  const n = bundle.quotes[symbol.toLowerCase()];
  return n != null && n > 0 ? n : null;
}
