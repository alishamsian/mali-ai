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
import { interpolate, t } from '../../../i18n';
import type { DashboardModel } from '../lib/dashboardModel';
import { homePalette } from './homePalette';

/** «How much can I still spend?»: what is left of the month's budget and the daily share. */
export function BudgetCard({
  model,
  hidden,
  onPress,
}: {
  model: DashboardModel;
  hidden: boolean;
  onPress: () => void;
}) {
  const { colors, mode } = useAppTheme();
  const dict = t();
  const p = homePalette(mode);
  const styles = useThemedStyles((c, th) => ({
    card: {
      padding: 16,
      borderRadius: 22,
      backgroundColor: c.glassStrong,
      borderWidth: 1,
      borderColor: c.glassBorder,
      gap: 6,
    },
    top: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
    caption: { color: c.textSecondary, fontSize: 13, textAlign: 'right' },
    pct: { color: c.textSecondary, fontSize: 12 },
    line: { flexDirection: 'row-reverse', alignItems: 'baseline', gap: 6 },
    amount: { fontSize: 24, lineHeight: 36, fontFamily: th.typography.fontFamily.bold },
    sub: { color: c.textSecondary, fontSize: 13, flexShrink: 1, textAlign: 'right' },
    track: {
      height: 8,
      borderRadius: 4,
      backgroundColor: p.track,
      overflow: 'hidden',
      flexDirection: 'row-reverse',
      marginTop: 4,
    },
    fill: { height: 8, borderRadius: 4 },
    setup: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
    setupText: { flex: 1, gap: 2 },
    setupTitle: {
      color: c.text,
      fontSize: 14,
      fontFamily: th.typography.fontFamily.semibold,
      textAlign: 'right',
    },
  }));
  if (model.budgetLimitRial == null || model.remainingRial == null) {
    return (
      <PressScale onPress={onPress} accessibilityRole="button" style={[styles.card, styles.setup]}>
        <View style={styles.setupText}>
          <AppText style={styles.setupTitle}>{dict.home.setBudget}</AppText>
          <AppText style={styles.caption}>{dict.dashboard.safeNoBudget}</AppText>
        </View>
        <ChevronLeft size={18} color={colors.textMuted} />
      </PressScale>
    );
  }
  const usedPct = Math.max(0, Math.round((model.budgetRatio ?? 0) * 100));
  const over = model.remainingRial < 0;
  const tone = over ? colors.warning : usedPct >= 80 ? colors.warning : colors.income;
  const money = (value: number) => (hidden ? '••••' : formatTomanFromRial(value));
  return (
    <PressScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={dict.home.monthBudget}
      style={styles.card}
      testID="home-budget">
      <View style={styles.top}>
        <AppText style={styles.caption}>
          {over ? dict.home.overBudget : dict.home.leftToSpend}
        </AppText>
        <AppText style={styles.pct}>
          {hidden ? '•••' : interpolate(dict.home.budgetUsed, { pct: toPersianDigits(usedPct) })}
        </AppText>
      </View>
      <View style={styles.line}>
        <MoneyText style={[styles.amount, over && { color: colors.warning }]} align="right">
          {money(Math.abs(model.remainingRial))}
        </MoneyText>
        <AppText style={styles.sub} numberOfLines={1}>
          {over || hidden
            ? displayUnitLabel()
            : `${displayUnitLabel()} · ${interpolate(dict.home.perDay, {
                amount: money(model.perDayRial),
              })}`}
        </AppText>
      </View>
      <View style={styles.track}>
        <View
          style={[styles.fill, { width: `${Math.min(100, usedPct)}%`, backgroundColor: tone }]}
        />
      </View>
    </PressScale>
  );
}
