import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from 'lucide-react-native';
import { AppText } from './AppText';
import { MoneyText } from './MoneyText';
import { useAppTheme } from '../../theme/ThemeBridge';
import { formatTomanFromRial } from '../../utils/currency/money';
import { theme } from '../../theme';
import { t } from '../../i18n';
import type { Transaction } from '../../types/finance';

export type FlowKind = 'income' | 'expense' | 'neutral';

const SURFACE: Record<FlowKind, { dark: [string, string]; light: [string, string] }> = {
  income: {
    dark: ['rgba(110,231,183,0.18)', 'rgba(59,232,197,0.07)'],
    light: ['rgba(15,138,98,0.16)', 'rgba(15,138,98,0.05)'],
  },
  expense: {
    dark: ['rgba(242,164,156,0.2)', 'rgba(200,90,82,0.08)'],
    light: ['rgba(196,92,86,0.16)', 'rgba(196,92,86,0.05)'],
  },
  neutral: {
    dark: ['rgba(139,124,255,0.16)', 'rgba(139,124,255,0.06)'],
    light: ['rgba(91,76,219,0.14)', 'rgba(91,76,219,0.05)'],
  },
};

export function flowKindForTransaction(tx: Pick<Transaction, 'direction' | 'type' | 'transferId'>): FlowKind {
  if (tx.transferId || tx.type === 'transfer' || tx.direction === 'internal') {
    return 'neutral';
  }
  return tx.direction === 'in' ? 'income' : 'expense';
}

export function flowTint(kind: FlowKind, colors: { income: string; expense: string; secondary: string }): string {
  if (kind === 'income') {
    return colors.income;
  }
  if (kind === 'expense') {
    return colors.expense;
  }
  return colors.secondary;
}

export function flowIconSurface(
  kind: FlowKind,
  mode: 'dark' | 'light',
): { backgroundColor: string; borderColor: string } {
  const [bg] = SURFACE[kind][mode];
  const border =
    kind === 'income'
      ? mode === 'dark'
        ? 'rgba(125,255,200,0.35)'
        : 'rgba(15,138,98,0.28)'
      : kind === 'expense'
        ? mode === 'dark'
          ? 'rgba(242,164,156,0.38)'
          : 'rgba(196,92,86,0.3)'
        : mode === 'dark'
          ? 'rgba(139,124,255,0.32)'
          : 'rgba(91,76,219,0.26)';
  return { backgroundColor: bg, borderColor: border };
}

export function FlowAmount({
  rial,
  kind,
  hidden,
  size = 'md',
  showLabel,
  style,
}: {
  rial: number;
  kind: FlowKind;
  hidden?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, mode } = useAppTheme();
  const dict = t();
  const tint = flowTint(kind, colors);
  const [bg] = SURFACE[kind][mode];
  const sign = kind === 'income' ? '+' : kind === 'expense' ? '−' : '';
  const Icon = kind === 'income' ? ArrowDownLeft : kind === 'expense' ? ArrowUpRight : ArrowLeftRight;
  const iconSize = size === 'lg' ? 20 : size === 'md' ? 14 : 12;
  const fontSize = size === 'lg' ? 26 : size === 'md' ? 15 : 13;
  const label =
    kind === 'income' ? dict.flow.income : kind === 'expense' ? dict.flow.expense : dict.flow.transfer;

  return (
    <View style={[styles.wrap, style]}>
      {showLabel ? (
        <AppText variant="caption" style={[styles.label, { color: tint }]}>
          {label}
        </AppText>
      ) : null}
      <View style={[styles.pill, { backgroundColor: bg, borderColor: `${tint}55` }]}>
        <Icon color={tint} size={iconSize} strokeWidth={2.4} />
        <MoneyText
          align="left"
          minFontScale={0.55}
          style={[
            styles.pillText,
            {
              color: tint,
              fontSize,
              letterSpacing: size === 'lg' ? 0.3 : 0,
            },
          ]}>
          {hidden ? '••••' : `${sign}${formatTomanFromRial(rial)}`}
        </MoneyText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-start', gap: 4 },
  label: {
    fontFamily: theme.typography.fontFamily.semibold,
    fontSize: 11,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  pill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: '100%',
  },
  pillText: {
    flexShrink: 1,
    maxWidth: '100%',
  },
});
