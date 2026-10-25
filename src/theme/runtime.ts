import { Appearance, unstable_batchedUpdates, type ColorSchemeName } from 'react-native';
import { colors, palette } from './colors';
import { theme } from './index';
import { accentById, type AccentPreset } from './accentPresets';
import type { AccentId } from '../types/finance';

export type ThemeModePref = 'dark' | 'light' | 'system';
type ThemeListener = () => void;

const DARK_PALETTE_BASE = {
  bg0: '#040608',
  bg1: '#070B0E',
  bg2: '#0B1114',
  surface: 'rgba(14, 22, 26, 0.72)',
  surfaceSolid: '#10181C',
  surfaceElevated: '#151E24',
  border: 'rgba(212, 180, 131, 0.14)',
  textPrimary: '#F3F1EA',
  textSecondary: 'rgba(243, 241, 234, 0.62)',
  textMuted: 'rgba(243, 241, 234, 0.38)',
} as const;

export type ThemeSnapshot = {
  revision: number;
  mode: 'dark' | 'light';
  accent: AccentPreset;
  colors: typeof theme.colors;
};

let revision = 0;
const listeners = new Set<ThemeListener>();
let currentMode: 'dark' | 'light' = 'dark';
let currentAccent: AccentPreset = accentById('emerald');
let appliedKey = '';
let cachedSnapshot: ThemeSnapshot = buildSnapshot();
let notifyScheduled = false;

function buildSnapshot(): ThemeSnapshot {
  return {
    revision,
    mode: currentMode,
    accent: currentAccent,
    colors: { ...theme.colors },
  };
}

export function getThemeRevision(): number {
  return revision;
}

export function getResolvedMode(): 'dark' | 'light' {
  return currentMode;
}

export function getCurrentAccent(): AccentPreset {
  return currentAccent;
}

/** مرجع ثابت تا وقتی revision عوض نشده */
export function getThemeSnapshot(): ThemeSnapshot {
  return cachedSnapshot;
}

export function subscribeTheme(listener: ThemeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function flushNotify() {
  notifyScheduled = false;
  const batch = unstable_batchedUpdates;
  const run = () => {
    listeners.forEach(l => {
      try {
        l();
      } catch {
        // ignore
      }
    });
  };
  if (typeof batch === 'function') {
    batch(run);
  } else {
    run();
  }
}

function notify() {
  revision += 1;
  cachedSnapshot = buildSnapshot();
  if (notifyScheduled) {
    return;
  }
  notifyScheduled = true;
  // defer تا وسط gesture ناوبری را نشکند
  Promise.resolve().then(flushNotify);
}

function resolveMode(pref: ThemeModePref, scheme: ColorSchemeName): 'dark' | 'light' {
  if (pref === 'light') {
    return 'light';
  }
  if (pref === 'system') {
    return scheme === 'light' ? 'light' : 'dark';
  }
  return 'dark';
}

type MutablePalette = {
  -readonly [K in keyof typeof palette]: (typeof palette)[K];
};

export function applyUserTheme(input: {
  theme?: ThemeModePref;
  accentId?: AccentId | string;
}): void {
  try {
    const pref: ThemeModePref =
      input.theme === 'light' || input.theme === 'system' || input.theme === 'dark'
        ? input.theme
        : 'dark';
    const mode = resolveMode(pref, Appearance.getColorScheme());
    const accent = accentById(input.accentId as AccentId | undefined);
    const key = `${pref}:${mode}:${accent.id}`;
    if (key === appliedKey) {
      return;
    }
    appliedKey = key;

    const base = colors[mode];
    // Glass daylight uses ink as the action colour; accents only tint the dark theme.
    const primary = mode === 'light' ? base.primary : accent.primary;

    currentMode = mode;
    currentAccent = accent;
    theme.mode = mode;

    Object.assign(theme.colors, {
      background: base.background,
      backgroundAlt: base.backgroundAlt,
      backgroundElevated: base.backgroundElevated,
      surface: base.surface,
      surfaceSolid: base.surfaceSolid,
      border: base.border,
      text: base.text,
      textSecondary: base.textSecondary,
      textMuted: base.textMuted,
      primary,
      secondary: base.secondary,
      filament: base.filament,
      income: base.income,
      expense: base.expense,
      success: base.success,
      warning: base.warning,
      onPrimary: base.onPrimary,
      glass: base.glass,
      glassStrong: base.glassStrong,
      glassBorder: base.glassBorder,
      highlight: base.highlight,
      onHighlight: base.onHighlight,
    });

    const p = palette as MutablePalette;
    p.primary = primary as typeof p.primary;
    p.primaryDim = accent.primaryDim as typeof p.primaryDim;
    p.primaryGlow = accent.primaryGlow as typeof p.primaryGlow;
    p.borderStrong = accent.borderStrong as typeof p.borderStrong;

    if (mode === 'light') {
      p.bg0 = base.background as typeof p.bg0;
      p.bg1 = base.backgroundAlt as typeof p.bg1;
      p.bg2 = base.backgroundElevated as typeof p.bg2;
      p.surfaceSolid = base.surfaceSolid as typeof p.surfaceSolid;
      p.surfaceElevated = base.backgroundElevated as typeof p.surfaceElevated;
      p.border = base.border as typeof p.border;
      p.textPrimary = base.text as typeof p.textPrimary;
      p.textSecondary = base.textSecondary as typeof p.textSecondary;
      p.textMuted = base.textMuted as typeof p.textMuted;
    } else {
      p.bg0 = DARK_PALETTE_BASE.bg0;
      p.bg1 = DARK_PALETTE_BASE.bg1;
      p.bg2 = DARK_PALETTE_BASE.bg2;
      p.surface = DARK_PALETTE_BASE.surface;
      p.surfaceSolid = DARK_PALETTE_BASE.surfaceSolid;
      p.surfaceElevated = DARK_PALETTE_BASE.surfaceElevated;
      p.border = DARK_PALETTE_BASE.border;
      p.textPrimary = DARK_PALETTE_BASE.textPrimary;
      p.textSecondary = DARK_PALETTE_BASE.textSecondary;
      p.textMuted = DARK_PALETTE_BASE.textMuted;
    }

    notify();
  } catch (e) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[theme] applyUserTheme failed', e);
    }
  }
}
