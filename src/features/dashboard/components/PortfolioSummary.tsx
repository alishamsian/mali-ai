import React from 'react';
import { View } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
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

/** «How much do I have?»: the total, its change since the same day last month, and this month's flow. */
export function PortfolioSummary({
  model,
  hidden,
  onHide,
  onOpen,
}: {
  model: DashboardModel;
  hidden: boolean;
  onHide: () => void;
  onOpen: () => void;
}) {
  const { colors, mode } = useAppTheme();
  const dict = t();
  const p = homePalette(mode);
  const styles = useThemedStyles((c, th) => ({
    card: {
      padding: 18,
      borderRadius: 24,
      backgroundColor: c.glassStrong,
      borderWidth: 1,
      borderColor: c.glassBorder,
    },
    heading: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    caption: { color: c.textSecondary, fontSize: 13, textAlign: 'right' },
    hide: { width: 44, height: 36, alignItems: 'flex-start', justifyContent: 'center' },
    money: { flexDirection: 'row-reverse', alignItems: 'baseline', gap: 8, minHeight: 54 },
    amount: {
      fontSize: 36,
      lineHeight: 54,
      fontFamily: th.typography.fontFamily.bold,
      flexShrink: 1,
    },
    unit: { fontSize: 14, color: c.textSecondary },
    badge: {
      alignSelf: 'flex-end',
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 11,
      paddingVertical: 4,
      borderRadius: 999,
      marginTop: 2,
    },
    change: { fontSize: 12.5, fontFamily: th.typography.fontFamily.semibold },
    flow: {
      flexDirection: 'row-reverse',
      marginTop: 16,
      paddingTop: 14,
      borderTopWidth: 1,
      borderColor: p.divider,
    },
    stat: { flex: 1, alignItems: 'flex-end', gap: 2 },
    split: { borderRightWidth: 1, borderColor: p.divider, paddingRight: 16 },
    statLabel: { color: c.textSecondary, fontSize: 12, textAlign: 'right' },
    statValue: { fontSize: 17, fontFamily: th.typography.fontFamily.bold, alignSelf: 'stretch' },
  }));
  const up = (model.changePct ?? 0) >= 0;
  const amount = (value: number) =>
    hidden ? '••••' : formatTomanFromRial(value, { sign: value < 0 });
  return (
    <View style={styles.card} testID="portfolio-summary">
      <View style={styles.heading}>
        <AppText style={styles.caption}>{dict.home.totalAssets}</AppText>
        <PressScale
          onPress={onHide}
          accessibilityRole="button"
          accessibilityLabel={hidden ? dict.home.showAmounts : dict.home.hideAmounts}
          accessibilityState={{ selected: hidden }}
          style={styles.hide}>
          {hidden ? (
            <EyeOff size={19} color={colors.textSecondary} />
          ) : (
            <Eye size={19} color={colors.textSecondary} />
          )}
        </PressScale>
      </View>
      <PressScale
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={dict.home.openWealth}>
        <View style={styles.money}>
          <MoneyText align="right" minFontScale={0.62} style={styles.amount}>
            {hidden
              ? '••••••••'
              : formatTomanFromRial(model.totalAssetsRial, { sign: model.totalAssetsRial < 0 })}
          </MoneyText>
          <AppText style={styles.unit}>{displayUnitLabel()}</AppText>
        </View>
      </PressScale>
      {!hidden && model.changePct != null ? (
        <View style={[styles.badge, { backgroundColor: up ? p.positive : p.gold[0] }]}>
          <AppText style={[styles.change, { color: up ? colors.income : colors.warning }]}>
            {up ? '▲' : '▼'}{' '}
            {toPersianDigits(Math.abs(model.changePct).toFixed(1)).replace('.', '٫')}٪{' '}
            {dict.home.vsSameTimeLastMonth}
          </AppText>
        </View>
      ) : null}
      <View style={styles.flow}>
        <View style={styles.stat}>
          <AppText style={styles.statLabel}>{dict.home.monthExpense}</AppText>
          <MoneyText style={styles.statValue} align="right">
            {amount(model.month.expenseRial)}
          </MoneyText>
        </View>
        <View style={[styles.stat, styles.split]}>
          <AppText style={styles.statLabel}>{dict.home.monthIncome}</AppText>
          <MoneyText style={[styles.statValue, { color: colors.income }]} align="right">
            {amount(model.month.incomeRial)}
          </MoneyText>
        </View>
      </View>
    </View>
  );
}
