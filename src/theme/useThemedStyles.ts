import { useMemo } from 'react';
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
import { theme } from './index';
import { getThemeSnapshot, type ThemeSnapshot } from './runtime';
import { useAppTheme } from './ThemeBridge';

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * StyleSheet تم‌آگاه: رنگ‌ها با هر تغییر revision دوباره ساخته می‌شوند.
 * spacing/radii/typography همچنان از theme استاتیک خوانده می‌شود.
 */
export function useThemedStyles<T extends NamedStyles<T> | NamedStyles<any>>(
  factory: (colors: ThemeSnapshot['colors'], t: typeof theme) => T,
): T {
  const { revision } = useAppTheme();
  // In dev, also rebuild on every render: the factory is a fresh closure after a Fast
  // Refresh edit, and caching on `revision` alone would hide style changes until restart.
  const devKey = __DEV__ ? {} : 0;
  return useMemo(() => {
    const { colors } = getThemeSnapshot();
    return StyleSheet.create(factory(colors, theme));
    // factory عمداً خارج از deps — فقط با revision تم عوض می‌شود
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision, devKey]);
}
