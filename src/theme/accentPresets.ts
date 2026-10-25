import type { AccentId } from '../types/finance';

export type AccentPreset = {
  id: AccentId;
  labelKey: AccentId;
  primary: string;
  primaryDim: string;
  primaryGlow: string;
  gradientEnd: string;
  orb: string;
  borderStrong: string;
};

/** پالت‌های پرمیوم برای تم اپ — نه رنگ‌های تصادفی */
export const ACCENT_PRESETS: AccentPreset[] = [
  {
    id: 'emerald',
    labelKey: 'emerald',
    primary: '#3BE8C5',
    primaryDim: '#1AA890',
    primaryGlow: 'rgba(59,232,197,0.22)',
    gradientEnd: '#7DFFD6',
    orb: 'rgba(59,232,197,0.14)',
    borderStrong: 'rgba(59,232,197,0.28)',
  },
  {
    id: 'ocean',
    labelKey: 'ocean',
    primary: '#5B9FFF',
    primaryDim: '#2F6FD6',
    primaryGlow: 'rgba(91,159,255,0.22)',
    gradientEnd: '#9BC7FF',
    orb: 'rgba(91,159,255,0.14)',
    borderStrong: 'rgba(91,159,255,0.28)',
  },
  {
    id: 'violet',
    labelKey: 'violet',
    primary: '#9B8CFF',
    primaryDim: '#6B5BD6',
    primaryGlow: 'rgba(155,140,255,0.22)',
    gradientEnd: '#C4BBFF',
    orb: 'rgba(155,140,255,0.14)',
    borderStrong: 'rgba(155,140,255,0.28)',
  },
  {
    id: 'gold',
    labelKey: 'gold',
    primary: '#E0C07A',
    primaryDim: '#B8943F',
    primaryGlow: 'rgba(224,192,122,0.22)',
    gradientEnd: '#F0D9A0',
    orb: 'rgba(224,192,122,0.14)',
    borderStrong: 'rgba(224,192,122,0.28)',
  },
  {
    id: 'rose',
    labelKey: 'rose',
    primary: '#F0A0B0',
    primaryDim: '#C46A7A',
    primaryGlow: 'rgba(240,160,176,0.22)',
    gradientEnd: '#F8C4CE',
    orb: 'rgba(240,160,176,0.14)',
    borderStrong: 'rgba(240,160,176,0.28)',
  },
  {
    id: 'graphite',
    labelKey: 'graphite',
    primary: '#A8B8C4',
    primaryDim: '#6E7E8A',
    primaryGlow: 'rgba(168,184,196,0.22)',
    gradientEnd: '#D0DAE2',
    orb: 'rgba(168,184,196,0.14)',
    borderStrong: 'rgba(168,184,196,0.28)',
  },
];

export function accentById(id?: AccentId): AccentPreset {
  return ACCENT_PRESETS.find(a => a.id === id) ?? ACCENT_PRESETS[0];
}
