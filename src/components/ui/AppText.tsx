import React, { useSyncExternalStore } from 'react';
import { StyleSheet, Text, type TextProps, type StyleProp, type TextStyle } from 'react-native';
import { theme } from '../../theme';
import { getThemeRevision, getThemeSnapshot, subscribeTheme } from '../../theme/runtime';

type Variant = 'display' | 'hero' | 'headline' | 'number' | 'title' | 'body' | 'caption' | 'label' | 'kicker';

const styles = StyleSheet.create({
  display: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: theme.typography.size.display,
    writingDirection: 'ltr',
    textAlign: 'right',
    letterSpacing: -0.8,
  },
  hero: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: theme.typography.size.hero,
    writingDirection: 'rtl',
    textAlign: 'right',
    letterSpacing: -0.6,
  },
  headline: {
    fontFamily: theme.typography.fontFamily.semibold,
    fontSize: theme.typography.size.titleLg,
    writingDirection: 'rtl',
    textAlign: 'right',
    letterSpacing: -0.4,
  },
  number: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: theme.typography.size.number,
    writingDirection: 'ltr',
    textAlign: 'right',
  },
  title: {
    fontFamily: theme.typography.fontFamily.semibold,
    fontSize: theme.typography.size.title,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  body: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.size.body,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  caption: {
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.size.sm,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  label: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: theme.typography.size.sm,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  kicker: {
    fontFamily: theme.typography.fontFamily.medium,
    fontSize: 11,
    writingDirection: 'rtl',
    textAlign: 'right',
  },
});

function colorForVariant(
  variant: Variant,
  colors: { text: string; textSecondary: string },
  filament: string,
): string {
  if (variant === 'caption' || variant === 'label') {
    return colors.textSecondary;
  }
  if (variant === 'kicker') {
    return filament;
  }
  return colors.text;
}

export function AppText({
  variant = 'body',
  style,
  ...rest
}: TextProps & { variant?: Variant }) {
  // فقط عدد revision — پایدار برای useSyncExternalStore
  useSyncExternalStore(subscribeTheme, getThemeRevision, getThemeRevision);
  const { colors } = getThemeSnapshot();
  const color = colorForVariant(variant, colors, theme.palette.filament);
  return <Text style={[styles[variant], { color }, style as StyleProp<TextStyle>]} {...rest} />;
}
