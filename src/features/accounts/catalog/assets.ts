import type { BankCardTheme } from '../../../theme/accents';
import type { AssetId } from '../../../types/finance';

export type AssetGroup = 'metal' | 'fiat' | 'crypto' | 'other';

export type AssetUnitKey = 'gram' | 'coin' | 'dollar' | 'euro' | 'tether' | 'unit';

export type AssetCatalogItem = {
  id: AssetId;
  group: AssetGroup;
  unitKey: AssetUnitKey;
  symbol: string;
  /** Optional default unit price in Toman for empty form hint only */
  hintUnitToman?: number;
  mark: string;
  theme: BankCardTheme;
};

/**
 * Visual catalog for vault assets. Prices are hints only — never live market data.
 */
export const ASSET_CATALOG: AssetCatalogItem[] = [
  {
    id: 'gold_gram',
    group: 'metal',
    unitKey: 'gram',
    symbol: 'Au',
    hintUnitToman: 7_500_000,
    mark: 'طلا',
    theme: {
      gradient: ['#F5D76E', '#C9A227', '#5C4310'],
      sheen: ['rgba(255,245,200,0.45)', 'rgba(255,200,80,0.12)', 'rgba(40,25,0,0.4)'],
      glow: 'rgba(255,210,80,0.28)',
      ink: '#1A1205',
      muted: 'rgba(26,18,5,0.62)',
    },
  },
  {
    id: 'gold_coin',
    group: 'metal',
    unitKey: 'coin',
    symbol: 'سکه',
    hintUnitToman: 75_000_000,
    mark: 'سکه',
    theme: {
      gradient: ['#FFE9A8', '#D4A017', '#6B4E0A'],
      sheen: ['rgba(255,250,220,0.5)', 'transparent', 'rgba(50,30,0,0.35)'],
      glow: 'rgba(255,200,60,0.3)',
      ink: '#1A1205',
      muted: 'rgba(26,18,5,0.62)',
    },
  },
  {
    id: 'silver',
    group: 'metal',
    unitKey: 'gram',
    symbol: 'Ag',
    hintUnitToman: 95_000,
    mark: 'نقره',
    theme: {
      gradient: ['#E8EEF2', '#9AA8B5', '#3A4550'],
      sheen: ['rgba(255,255,255,0.55)', 'transparent', 'rgba(20,30,40,0.35)'],
      glow: 'rgba(200,220,240,0.25)',
      ink: '#0E1418',
      muted: 'rgba(14,20,24,0.6)',
    },
  },
  {
    id: 'usd',
    group: 'fiat',
    unitKey: 'dollar',
    symbol: '$',
    hintUnitToman: 920_000,
    mark: 'USD',
    theme: {
      gradient: ['#34D399', '#059669', '#064E3B'],
      sheen: ['rgba(180,255,220,0.32)', 'transparent', 'rgba(0,40,25,0.4)'],
      glow: 'rgba(52,211,153,0.28)',
      ink: '#F0FFF7',
      muted: 'rgba(240,255,247,0.7)',
    },
  },
  {
    id: 'eur',
    group: 'fiat',
    unitKey: 'euro',
    symbol: '€',
    hintUnitToman: 980_000,
    mark: 'EUR',
    theme: {
      gradient: ['#60A5FA', '#2563EB', '#1E3A8A'],
      sheen: ['rgba(180,210,255,0.35)', 'transparent', 'rgba(10,20,60,0.4)'],
      glow: 'rgba(96,165,250,0.28)',
      ink: '#F0F7FF',
      muted: 'rgba(240,247,255,0.7)',
    },
  },
  {
    id: 'usdt',
    group: 'crypto',
    unitKey: 'tether',
    symbol: '₮',
    hintUnitToman: 920_000,
    mark: 'USDT',
    theme: {
      gradient: ['#2DD4BF', '#0F766E', '#042F2E'],
      sheen: ['rgba(160,255,240,0.3)', 'transparent', 'rgba(0,40,35,0.45)'],
      glow: 'rgba(45,212,191,0.3)',
      ink: '#ECFEFF',
      muted: 'rgba(236,254,255,0.7)',
    },
  },
  {
    id: 'crypto',
    group: 'crypto',
    unitKey: 'unit',
    symbol: '₿',
    mark: 'کریپتو',
    theme: {
      gradient: ['#F59E0B', '#B45309', '#451A03'],
      sheen: ['rgba(255,220,150,0.3)', 'transparent', 'rgba(40,20,0,0.4)'],
      glow: 'rgba(245,158,11,0.28)',
      ink: '#FFFBEB',
      muted: 'rgba(255,251,235,0.7)',
    },
  },
  {
    id: 'other',
    group: 'other',
    unitKey: 'unit',
    symbol: '◇',
    mark: 'سایر',
    theme: {
      gradient: ['#A78BFA', '#6D28D9', '#2E1065'],
      sheen: ['rgba(220,200,255,0.3)', 'transparent', 'rgba(30,10,60,0.4)'],
      glow: 'rgba(167,139,250,0.28)',
      ink: '#F5F3FF',
      muted: 'rgba(245,243,255,0.7)',
    },
  },
];

export function getAssetCatalog(id?: string): AssetCatalogItem | undefined {
  if (!id) {
    return undefined;
  }
  return ASSET_CATALOG.find(a => a.id === id);
}

export function isAssetAccount(kind?: string): boolean {
  return kind === 'asset';
}

export function assetValueRial(quantity: number, unitPriceRial: number): number {
  return Math.round(quantity * unitPriceRial);
}
