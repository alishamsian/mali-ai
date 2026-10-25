import type { CategoryId } from '../types/finance';
import { palette } from './colors';

export const CATEGORY_COLOR: Record<CategoryId, string> = {
  housing: '#8B7CFF',
  food: '#3BE8C5',
  transport: '#4C8DFF',
  shopping: '#D4B483',
  bills: '#E8C36A',
  health: '#F2A49C',
  entertainment: '#C084FC',
  education: '#7DD3FC',
  travel: '#34D399',
  clothing: '#F9A8D4',
  subscriptions: '#A78BFA',
  income: palette.income,
  transfer: '#94A3B8',
  fee: '#FB923C',
  other: '#64748B',
};

/**
 * الهام از کارت‌های واقعی بانک‌ها:
 * - ملی: سبز سازمانی / طرح‌های دماوند
 * - ملت: قرمز برند (گل لاله)
 * - سامان / بلوکارت: آبی امضای بلوبانک
 * - تجارت: نارنجی سازمانی
 * - پاسارگاد: نارنجی–مشکی / کارت‌های طلایی–پرمیوم
 */
export type BankCardTheme = {
  /** گرادیان اصلی کارت (۳ نقطه برای عمق بیشتر) */
  gradient: [string, string, string];
  /** هایلایت براق */
  sheen: [string, string, string];
  /** درخشش گوشه */
  glow: string;
  /** رنگ متن روی کارت */
  ink: string;
  muted: string;
};

export const BANK_CARD_THEME: Record<string, BankCardTheme> = {
  melli: {
    // سبز جنگلی غنی → سبز تیره دماوند
    gradient: ['#1FAE6A', '#0B6B3F', '#043821'],
    sheen: ['rgba(180,255,210,0.28)', 'transparent', 'rgba(0,40,20,0.35)'],
    glow: 'rgba(90,220,150,0.22)',
    ink: '#F4FFF8',
    muted: 'rgba(244,255,248,0.7)',
  },
  mellat: {
    // قرمز برند ملت → زرشکی عمیق
    gradient: ['#E11D2E', '#A01020', '#4A0610'],
    sheen: ['rgba(255,200,200,0.26)', 'transparent', 'rgba(40,0,8,0.4)'],
    glow: 'rgba(255,90,100,0.2)',
    ink: '#FFF5F5',
    muted: 'rgba(255,245,245,0.7)',
  },
  saman: {
    // آبی امضای بلوکارت
    gradient: ['#3B82F6', '#1D4ED8', '#0B1F5C'],
    sheen: ['rgba(180,210,255,0.3)', 'transparent', 'rgba(5,15,50,0.4)'],
    glow: 'rgba(96,165,250,0.25)',
    ink: '#F0F7FF',
    muted: 'rgba(240,247,255,0.7)',
  },
  tejarat: {
    // نارنجی روشن تجارت
    gradient: ['#FF8A1F', '#E85D04', '#7C2D12'],
    sheen: ['rgba(255,230,180,0.3)', 'transparent', 'rgba(60,20,0,0.35)'],
    glow: 'rgba(255,170,70,0.25)',
    ink: '#FFF8F0',
    muted: 'rgba(255,248,240,0.72)',
  },
  pasargad: {
    // مشکی–نارنجی سازمانی / حس کارت طلایی پاسارگاد
    gradient: ['#2A2418', '#1A120C', '#0A0806'],
    sheen: ['rgba(232,180,90,0.22)', 'rgba(255,140,50,0.08)', 'rgba(0,0,0,0.45)'],
    glow: 'rgba(232,160,70,0.2)',
    ink: '#F8EED8',
    muted: 'rgba(248,238,216,0.68)',
  },
  cash: {
    gradient: ['#3A4550', '#1E262C', '#0E1316'],
    sheen: ['rgba(255,255,255,0.14)', 'transparent', 'rgba(0,0,0,0.3)'],
    glow: 'rgba(255,255,255,0.08)',
    ink: '#F3F1EA',
    muted: 'rgba(243,241,234,0.65)',
  },
};

/** سازگاری با کدهای قدیمی که فقط دو رنگ می‌خواستند */
export const BANK_GRADIENT: Record<string, [string, string]> = Object.fromEntries(
  Object.entries(BANK_CARD_THEME).map(([id, theme]) => [id, [theme.gradient[0], theme.gradient[2]]]),
) as Record<string, [string, string]>;

export function bankCardTheme(bankId?: string): BankCardTheme {
  if (bankId && BANK_CARD_THEME[bankId]) {
    return BANK_CARD_THEME[bankId];
  }
  return {
    gradient: ['#1A2228', '#12171B', '#0A0E10'],
    sheen: ['rgba(255,255,255,0.16)', 'transparent', 'rgba(0,0,0,0.28)'],
    glow: 'rgba(255,255,255,0.08)',
    ink: '#F7F4EE',
    muted: 'rgba(247,244,238,0.68)',
  };
}
