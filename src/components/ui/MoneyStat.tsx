import React from 'react';
import { StyleSheet, View } from 'react-native';
import { theme } from '../../theme';
import { useAppTheme } from '../../theme/ThemeBridge';
import { AppText } from './AppText';

export function MoneyStat({
  label,
  value,
  tone = 'plain',
  hidden,
  compact,
}: {
  label: string;
  value: string;
  tone?: 'in' | 'out' | 'plain';
  hidden?: boolean;
  compact?: boolean;
}) {
  const { colors } = useAppTheme();
  const color =
    tone === 'in' ? colors.income : tone === 'out' ? colors.expense : colors.text;
  return (
    <View style={[styles.wrap, compact && styles.compact]}>
      <AppText variant="caption">{label}</AppText>
      <AppText variant={compact ? 'body' : 'title'} style={[styles.value, { color }]}>
        {hidden ? '••••' : value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'flex-end', gap: 4 },
  compact: { gap: 2 },
  value: {
    fontFamily: theme.typography.fontFamily.semibold,
    writingDirection: 'ltr',
  },
});
