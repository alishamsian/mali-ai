import React, { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '../../../components/ui/AppText';
import { MoneyText } from '../../../components/ui/MoneyText';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { WeekSpendChart } from './WeekSpendChart';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { formatTomanLabel, type DisplayCurrency } from '../../../utils/currency/money';
import { interpolate, t } from '../../../i18n';
import type { DaySummary } from '../../../engine/insights/dailyLedger';

export function DaySummaryCard({
  summary,
  monthlyNet,
  budgetHint,
  hidden,
  currency,
  isToday,
  trend,
  trendLabels,
  insight,
}: {
  summary: DaySummary;
  monthlyNet: number;
  budgetHint: { remainingMonthRial: number; dailyAllowanceRial: number } | null;
  hidden: boolean;
  currency: DisplayCurrency;
  isToday: boolean;
  /** Spend per day for the week ending on this day, oldest first. */
  trend: number[];
  /** Short weekday names for `trend`, same order. */
  trendLabels: string[];
  /** One line comparing this day with the days before it. */
  insight?: string | null;
}) {
  const { colors } = useAppTheme();
  const dict = t();
  const [chartWidth, setChartWidth] = useState(0);
  const styles = useThemedStyles((c, th) => ({
    card: { padding: 16, marginHorizontal: 16, gap: 10 },
    metrics: { flexDirection: 'row-reverse', gap: 12 },
    metric: { flex: 1, minWidth: 0, gap: 4 },
    label: { textAlign: 'right', color: c.textMuted, fontSize: 12 },
    amount: { fontSize: 21, fontFamily: th.typography.fontFamily.semibold, width: '100%' },
    net: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    netLabel: { fontSize: 12, color: c.textSecondary, textAlign: 'right' },
    netAmount: { flex: 1, fontSize: 15, fontFamily: th.typography.fontFamily.semibold },
    trend: { gap: 4, marginTop: 2 },
    trendLabel: { fontSize: 11, color: c.textMuted, textAlign: 'right' },
    detail: { fontSize: 11, color: c.textMuted, textAlign: 'right', lineHeight: 19 },
  }));
  const money = (value: number, sign = false) =>
    hidden ? '••••' : formatTomanLabel(value, { sign, displayCurrency: currency });

  return (
    <GlassPanel strong radius={24} style={styles.card}>
      <View style={styles.metrics}>
        <View style={styles.metric}>
          <AppText style={styles.label}>{dict.daily.expense}</AppText>
          <MoneyText align="right" style={styles.amount}>
            {money(summary.expenseRial)}
          </MoneyText>
        </View>
        <View style={styles.metric}>
          <AppText style={styles.label}>{dict.daily.income}</AppText>
          <MoneyText align="right" style={[styles.amount, { color: colors.income }]}>
            {money(summary.incomeRial)}
          </MoneyText>
        </View>
      </View>
      {!hidden && trend.some(v => v > 0) ? (
        <View
          testID="daily-spend-trend"
          style={styles.trend}
          onLayout={e => setChartWidth(e.nativeEvent.layout.width)}>
          <AppText style={styles.trendLabel}>{dict.daily.spendTrend}</AppText>
          {chartWidth > 0 ? (
            <WeekSpendChart
              values={trend}
              labels={trendLabels}
              color={colors.income}
              gridColor={colors.border}
              width={chartWidth}
            />
          ) : null}
          {insight ? <AppText style={styles.detail}>{insight}</AppText> : null}
        </View>
      ) : null}
      <View style={styles.net}>
        <AppText style={styles.netLabel}>{dict.daily.cashFlow}</AppText>
        <MoneyText
          align="left"
          style={[
            styles.netAmount,
            { color: hidden ? colors.text : summary.netRial < 0 ? colors.expense : colors.income },
          ]}>
          {money(summary.netRial, true)}
        </MoneyText>
      </View>
      {summary.refundRial > 0 ? (
        <AppText style={styles.detail}>
          {dict.daily.refund}: {money(summary.refundRial)}
        </AppText>
      ) : null}
      <AppText style={styles.detail}>
        {dict.daily.financialMonthNet}: {money(monthlyNet, true)}
      </AppText>
      {budgetHint && isToday ? (
        <AppText
          style={[
            styles.detail,
            !hidden && budgetHint.remainingMonthRial < 0 && { color: colors.expense },
          ]}>
          {hidden
            ? dict.daily.budgetHidden
            : budgetHint.remainingMonthRial < 0
            ? dict.daily.budgetOver
            : budgetHint.remainingMonthRial === 0
            ? dict.daily.budgetReached
            : interpolate(dict.daily.budgetDaily, {
                amount: formatTomanLabel(budgetHint.dailyAllowanceRial, {
                  displayCurrency: currency,
                }),
              })}
        </AppText>
      ) : null}
    </GlassPanel>
  );
}
