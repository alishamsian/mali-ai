import { palette } from './colors';
import { spacing } from './spacing';
import { radii } from './radii';
import { typography } from './typography';
import { animations } from './animations';
import { shadows } from './shadows';

/** توکن‌های معنایی — منبع واحد برای UI جدید پولت */
export const tokens = {
  brand: {
    name: 'پولت',
    nameEn: 'Polt',
    accent: palette.primary,
    accentMuted: palette.primaryDim,
    gold: palette.filament,
    goldGlow: 'rgba(212, 180, 131, 0.22)',
  },
  surface: {
    background: palette.bg0,
    backgroundAlt: palette.bg1,
    backgroundElevated: palette.bg2,
    card: palette.surfaceSolid,
    cardElevated: palette.surfaceElevated,
    interactive: 'rgba(255, 255, 255, 0.04)',
    glass: palette.surface,
  },
  text: {
    primary: palette.textPrimary,
    secondary: palette.textSecondary,
    muted: palette.textMuted,
    inverse: palette.ink,
  },
  border: {
    subtle: palette.border,
    strong: palette.borderStrong,
    hairline: 'rgba(255, 255, 255, 0.06)',
  },
  financial: {
    income: palette.income,
    expense: palette.expense,
    neutral: palette.secondary,
    warning: palette.warning,
    success: palette.success,
  },
  spacing,
  radii,
  typography,
  motion: animations,
  shadow: shadows,
  icon: {
    xs: 14,
    sm: 18,
    md: 22,
    lg: 28,
    xl: 36,
  },
  touch: {
    min: 44,
    comfortable: 48,
  },
  layout: {
    screenPadding: spacing.lg,
    tabBarClearance: 108,
    sectionGap: spacing.xl,
  },
  zIndex: {
    base: 0,
    elevated: 10,
    tabBar: 50,
    overlay: 100,
    modal: 200,
  },
} as const;

export type DesignTokens = typeof tokens;
