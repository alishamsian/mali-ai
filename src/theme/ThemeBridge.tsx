import React, { useEffect, useSyncExternalStore } from 'react';
import { Appearance, StatusBar } from 'react-native';
import { useFinanceStore } from '../store/finance/store';
import type { AccentId } from '../types/finance';
import {
  applyUserTheme,
  getThemeRevision,
  getThemeSnapshot,
  subscribeTheme,
  type ThemeSnapshot,
} from './runtime';

export type AppThemeContextValue = ThemeSnapshot;

/**
 * فقط revision (عدد) را subscribe می‌کند تا getSnapshot همیشه پایدار باشد.
 * رنگ‌ها از اسنپ‌شات کش‌شده همان revision خوانده می‌شوند.
 */
export function useAppTheme(): ThemeSnapshot {
  useSyncExternalStore(subscribeTheme, getThemeRevision, getThemeRevision);
  return getThemeSnapshot();
}

/**
 * همگام تنظیمات استور با تم — بدون state محلی روی Provider.
 */
export function ThemeBridge({ children }: { children: React.ReactNode }) {
  const themePref = useFinanceStore(s => s.snapshot.settings.theme ?? 'dark');
  const accentId = useFinanceStore(
    s => (s.snapshot.settings.accentId ?? 'emerald') as AccentId,
  );

  useEffect(() => {
    applyUserTheme({ theme: themePref, accentId });
  }, [themePref, accentId]);

  useEffect(() => {
    if (themePref !== 'system') {
      return;
    }
    const sub = Appearance.addChangeListener(() => {
      applyUserTheme({ theme: 'system', accentId });
    });
    return () => sub.remove();
  }, [themePref, accentId]);

  return (
    <>
      <ThemeStatusBar />
      {children}
    </>
  );
}

function ThemeStatusBar() {
  const { mode } = useAppTheme();
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        StatusBar.setBarStyle(mode === 'light' ? 'dark-content' : 'light-content');
      } catch {
        // ignore
      }
    }, 50);
    return () => clearTimeout(id);
  }, [mode]);
  return null;
}
