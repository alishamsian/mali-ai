import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { theme } from '../../theme';
import { useAppTheme } from '../../theme/ThemeBridge';

export function GlassCard({ children, style, ...rest }: ViewProps) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        style,
      ]}
      {...rest}>
      <View style={[styles.slit, { backgroundColor: colors.primary }]} />
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
