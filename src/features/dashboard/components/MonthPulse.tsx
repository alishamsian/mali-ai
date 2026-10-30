import React from 'react';
import { View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { AppText } from '../../../components/ui/AppText';
import { MoneyText } from '../../../components/ui/MoneyText';
import { PressScale } from '../../../components/ui/PressScale';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { formatTomanFromRial, displayUnitLabel } from '../../../utils/currency/money';
import { toPersianDigits } from '../../../utils/numbers/digits';
import { t } from '../../../i18n';
import type { DashboardModel } from '../lib/dashboardModel';
import { homePalette } from './homePalette';

export function MonthPulse({
  model,
  hidden,
  label,
  onReport,
  onBudget,
}: {
  model: DashboardModel;
  hidden: boolean;
  label: string;
  onReport: () => void;
  onBudget: () => void;
}) {
  const { colors, mode } = useAppTheme();
  const dict = t();
  const p = homePalette(mode);
  const ratio = model.budgetRatio;
  const usedPct = Math.max(0, Math.round((ratio ?? 0) * 100));
  const chartMax = Math.max(1, ...model.week.map(d => d.rial));
  const hasSpend = model.week.some(day => day.rial > 0);
  const styles = useThemedStyles((c, th) => ({
    root: {
      padding: 16,
      borderRadius: 22,
      backgroundColor: c.glassStrong,
      borderWidth: 1,
      borderColor: c.glassBorder,
      gap: 13,
    },
    header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
    title: { color: c.text, fontSize: 16, fontFamily: th.typography.fontFamily.bold },
    period: { color: c.textMuted, fontSize: 10, marginTop: 1 },
    report: { flexDirection: 'row-reverse', alignItems: 'center', gap: 3, minHeight: 44 },
    reportText: { color: c.textSecondary, fontSize: 12 },
    main: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 14,
    },
    spending: { flex: 1, alignItems: 'flex-end', minWidth: 0 },
    caption: { fontSize: 11, color: c.textMuted, textAlign: 'right' },
    amount: {
      fontSize: 27,
      lineHeight: 41,
      fontFamily: th.typography.fontFamily.bold,
      alignSelf: 'stretch',
    },
    unit: { color: c.textMuted, fontSize: 10, textAlign: 'right' },
    chart: { width: 125, gap: 5 },
    bars: {
      height: 54,
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 6,
      justifyContent: 'space-between',
    },
    bar: { width: 12, borderRadius: 6 },
    chartCaption: { fontSize: 9, color: c.textMuted, textAlign: 'left' },
    noSpend: { height: 54, justifyContent: 'center' },
    noSpendText: { color: c.textMuted, fontSize: 10, textAlign: 'center', lineHeight: 17 },
    bottom: {
      flexDirection: 'row-reverse',
      paddingTop: 12,
      borderTopWidth: 1,
      borderColor: p.divider,
      alignItems: 'center',
    },
    budget: { flex: 1.1, gap: 6, paddingLeft: 12, minHeight: 44, justifyContent: 'center' },
    budgetLine: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    percent: { fontSize: 11, color: c.text, writingDirection: 'ltr' },
    track: {
      height: 5,
      borderRadius: 3,
      backgroundColor: p.track,
      overflow: 'hidden',
      flexDirection: 'row-reverse',
    },
    fill: { height: 5, borderRadius: 3, backgroundColor: c.income },
    stat: {
      flex: 1,
      borderRightWidth: 1,
      borderColor: p.divider,
      alignItems: 'flex-end',
      gap: 3,
      paddingHorizontal: 10,
    },
    statValue: {
      fontSize: 14,
      fontFamily: th.typography.fontFamily.semibold,
      alignSelf: 'stretch',
    },
    setBudget: { color: c.text, fontSize: 11, fontFamily: th.typography.fontFamily.medium },
  }));
  const amount = (value: number) =>
    hidden ? '••••' : formatTomanFromRial(value, { sign: value < 0 });
  return (
    <View style={styles.root} testID="home-month-pulse">
      <View style={styles.header}>
        <View>
          <AppText style={styles.title}>{dict.dashboard.monthPulse}</AppText>
          <AppText style={styles.period}>{label}</AppText>
        </View>
        <PressScale
          onPress={onReport}
          style={styles.report}
          accessibilityRole="button"
          accessibilityLabel={dict.dashboard.monthReport}>
          <AppText style={styles.reportText}>{dict.home.report}</AppText>
          <ChevronLeft size={15} color={colors.textSecondary} />
        </PressScale>
      </View>
      <View style={styles.main}>
        <View style={styles.spending}>
          <AppText style={styles.caption}>{dict.home.monthExpense}</AppText>
          <MoneyText style={styles.amount} align="right">
            {amount(model.month.expenseRial)}
          </MoneyText>
          <AppText style={styles.unit}>{displayUnitLabel()}</AppText>
        </View>
        <View
          style={styles.chart}
          accessibilityLabel={
            hidden
              ? dict.home.amountHidden
              : `${dict.home.lastSevenDays}، ${formatTomanFromRial(
                  model.week.reduce((sum, day) => sum + day.rial, 0),
                )} ${displayUnitLabel()}`
          }
          accessible>
          {hidden || !hasSpend ? (
            <View style={styles.noSpend}>
              <AppText style={styles.noSpendText}>
                {hidden ? '••••' : dict.home.noWeeklySpend}
              </AppText>
            </View>
          ) : (
            <View style={styles.bars} importantForAccessibility="no-hide-descendants">
              {model.week.map((day, i) => (
                <View
                  key={day.key}
                  style={[
                    styles.bar,
                    {
                      height: day.rial > 0 ? Math.max(6, (day.rial / chartMax) * 54) : 2,
                      backgroundColor: i >= 5 ? colors.income : p.bar,
                    },
                  ]}
                />
              ))}
            </View>
          )}
          <AppText style={styles.chartCaption}>{dict.home.lastSevenDays}</AppText>
        </View>
      </View>
      <View style={styles.bottom}>
        <PressScale
          onPress={onBudget}
          style={styles.budget}
          accessibilityRole="button"
          accessibilityLabel={
            hidden
              ? dict.home.monthBudget
              : ratio == null
              ? dict.home.setBudget
              : `${dict.home.monthBudget}، ${toPersianDigits(usedPct)}٪`
          }>
          <View style={styles.budgetLine}>
            <AppText style={styles.caption}>{dict.home.monthBudget}</AppText>
            {ratio != null ? (
              <AppText style={[styles.percent, usedPct > 100 && { color: colors.warning }]}>
                {hidden ? '•••' : `${toPersianDigits(usedPct)}٪`}
              </AppText>
            ) : null}
          </View>
          {hidden ? (
            <AppText style={styles.setBudget}>•••</AppText>
          ) : ratio == null ? (
            <AppText style={styles.setBudget}>{dict.home.setBudget}</AppText>
          ) : (
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${Math.min(100, usedPct)}%`,
                    backgroundColor: usedPct > 100 ? colors.warning : colors.income,
                  },
                ]}
              />
            </View>
          )}
        </PressScale>
        <View style={styles.stat}>
          <AppText style={styles.caption}>{dict.dashboard.income}</AppText>
          <MoneyText style={[styles.statValue, { color: colors.income }]} align="right">
            {amount(model.month.incomeRial)}
          </MoneyText>
          <AppText style={styles.unit}>{displayUnitLabel()}</AppText>
        </View>
        <View style={styles.stat}>
          <AppText style={styles.caption}>{dict.dashboard.savings}</AppText>
          <MoneyText style={styles.statValue} align="right">
            {amount(model.month.savingsRial)}
          </MoneyText>
          <AppText style={styles.unit}>{displayUnitLabel()}</AppText>
        </View>
      </View>
    </View>
  );
}
