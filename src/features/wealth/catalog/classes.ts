import type { FinancialAccount } from '../../../types/finance';
import type { AssetClass, AssetLiquidity } from '../../../types/wealth';

export type AssetClassMeta = {
  id: AssetClass;
  /** Lucide-friendly key for UI mapping */
  icon: string;
  accent: string;
  accentMuted: string;
  defaultLiquidity: AssetLiquidity;
  supportsPl: boolean;
};

export const ASSET_CLASS_META: Record<AssetClass, AssetClassMeta> = {
  cash: {
    id: 'cash',
    icon: 'banknote',
    accent: '#34D399',
    accentMuted: 'rgba(52,211,153,0.14)',
    defaultLiquidity: 'high',
    supportsPl: false,
  },
  bank: {
    id: 'bank',
    icon: 'landmark',
    accent: '#5EEAD4',
    accentMuted: 'rgba(94,234,212,0.12)',
    defaultLiquidity: 'high',
    supportsPl: false,
  },
  gold: {
    id: 'gold',
    icon: 'coins',
    accent: '#D4AF37',
    accentMuted: 'rgba(212,175,55,0.14)',
    defaultLiquidity: 'medium',
    supportsPl: true,
  },
  silver: {
    id: 'silver',
    icon: 'circle',
    accent: '#94A3B8',
    accentMuted: 'rgba(148,163,184,0.14)',
    defaultLiquidity: 'medium',
    supportsPl: true,
  },
  currency: {
    id: 'currency',
    icon: 'dollar-sign',
    accent: '#4ADE80',
    accentMuted: 'rgba(74,222,128,0.12)',
    defaultLiquidity: 'high',
    supportsPl: true,
  },
  crypto: {
    id: 'crypto',
    icon: 'bitcoin',
    accent: '#F59E0B',
    accentMuted: 'rgba(245,158,11,0.14)',
    defaultLiquidity: 'medium',
    supportsPl: true,
  },
  stock: {
    id: 'stock',
    icon: 'trending-up',
    accent: '#60A5FA',
    accentMuted: 'rgba(96,165,250,0.12)',
    defaultLiquidity: 'medium',
    supportsPl: true,
  },
  fund: {
    id: 'fund',
    icon: 'pie-chart',
    accent: '#818CF8',
    accentMuted: 'rgba(129,140,248,0.12)',
    defaultLiquidity: 'medium',
    supportsPl: true,
  },
  real_estate: {
    id: 'real_estate',
    icon: 'home',
    accent: '#FB923C',
    accentMuted: 'rgba(251,146,60,0.12)',
    defaultLiquidity: 'low',
    supportsPl: true,
  },
  vehicle: {
    id: 'vehicle',
    icon: 'car',
    accent: '#F472B6',
    accentMuted: 'rgba(244,114,182,0.12)',
    defaultLiquidity: 'low',
    supportsPl: true,
  },
  jewelry: {
    id: 'jewelry',
    icon: 'gem',
    accent: '#E879F9',
    accentMuted: 'rgba(232,121,249,0.12)',
    defaultLiquidity: 'low',
    supportsPl: true,
  },
  collectible: {
    id: 'collectible',
    icon: 'palette',
    accent: '#A78BFA',
    accentMuted: 'rgba(167,139,250,0.12)',
    defaultLiquidity: 'low',
    supportsPl: true,
  },
  business: {
    id: 'business',
    icon: 'briefcase',
    accent: '#38BDF8',
    accentMuted: 'rgba(56,189,248,0.12)',
    defaultLiquidity: 'low',
    supportsPl: true,
  },
  other: {
    id: 'other',
    icon: 'box',
    accent: '#94A3B8',
    accentMuted: 'rgba(148,163,184,0.1)',
    defaultLiquidity: 'low',
    supportsPl: true,
  },
};

export const ASSET_CLASS_ORDER: AssetClass[] = [
  'cash',
  'bank',
  'gold',
  'silver',
  'currency',
  'crypto',
  'stock',
  'fund',
  'real_estate',
  'vehicle',
  'jewelry',
  'collectible',
  'business',
  'other',
];

export function resolveAssetClass(account: FinancialAccount): AssetClass {
  if (account.assetClass) {
    return account.assetClass;
  }
  if (account.kind === 'bank' || account.kind === 'card') {
    return 'bank';
  }
  if (account.kind === 'cash' || account.kind === 'wallet') {
    return 'cash';
  }
  if (account.kind === 'asset') {
    switch (account.assetId) {
      case 'gold_gram':
      case 'gold_coin':
        return 'gold';
      case 'silver':
        return 'silver';
      case 'usd':
      case 'eur':
        return 'currency';
      case 'usdt':
      case 'crypto':
        return 'crypto';
      default:
        return 'other';
    }
  }
  return 'other';
}

/**
 * Glass daylight chart colours: each class differs in hue and lightness and keeps
 * ≥3:1 against the frosted panels (the dark-theme accents are too pale on white).
 */
const LIGHT_ALLOCATION: Record<AssetClass, string> = {
  bank: '#111316',
  cash: '#17703E',
  gold: '#A86E10',
  silver: '#6B7280',
  currency: '#1F5FA8',
  crypto: '#C2410C',
  stock: '#5B48D9',
  fund: '#0E7490',
  real_estate: '#9D174D',
  vehicle: '#475569',
  jewelry: '#BE185D',
  collectible: '#7C3AED',
  business: '#0F766E',
  other: '#8A939C',
};

export function allocationColor(assetClass: AssetClass, mode: 'dark' | 'light' = 'dark'): string {
  return mode === 'light' ? LIGHT_ALLOCATION[assetClass] : ASSET_CLASS_META[assetClass].accent;
}
