import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { theme } from '../../theme';
import { useAppTheme } from '../../theme/ThemeBridge';

export function GlassCard({ children, style, ...rest }: ViewProps) {
  const { colors, mode } = useAppTheme();
  // Glass daylight: plain frosted panel; the vault corners and ink slit belong to the dark theme.
  const light = mode === 'light';
  return (
    <View
      style={[
        styles.card,
        light && styles.cardLight,
        {
          backgroundColor: light ? colors.glass : colors.surface,
          borderColor: light ? colors.glassBorder : colors.border,
        },
        style,
      ]}
      {...rest}>
      {light ? null : <View style={[styles.slit, { backgroundColor: colors.primary }]} />}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderTopLeftRadius: theme.radii.vault.tl,
    borderTopRightRadius: theme.radii.vault.tr,
    borderBottomRightRadius: theme.radii.vault.br,
    borderBottomLeftRadius: theme.radii.vault.bl,
    borderWidth: 1,
    padding: theme.spacing.lg,
    overflow: 'hidden',
  },
  cardLight: { borderRadius: 24 },
  slit: {
    position: 'absolute',
    top: 18,
    bottom: 18,
    right: 0,
    width: 2,
    borderTopLeftRadius: 2,
    borderBottomLeftRadius: 2,
    opacity: 0.5,
  },
});
