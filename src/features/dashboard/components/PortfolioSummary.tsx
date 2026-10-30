import React from 'react';
import { View, useWindowDimensions } from 'react-native';
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
import { WealthTrend } from './WealthTrend';
import { homePalette } from './homePalette';

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
  const { width } = useWindowDimensions();
  const dict = t();
  const p = homePalette(mode);
  const styles = useThemedStyles((c, th) => ({
    root: { gap: 3, paddingTop: 3, paddingBottom: 5 },
    heading: { flexDirection: 'row-reverse', alignItems: 'center' },
    caption: { color: c.textMuted, fontSize: 13, textAlign: 'right' },
    hide: { minWidth: 44, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
    money: { flexDirection: 'row-reverse', alignItems: 'baseline', gap: 8, minHeight: 56 },
    amount: {
      fontSize: 37,
      lineHeight: 56,
      fontFamily: th.typography.fontFamily.bold,
      flexShrink: 1,
    },
    unit: { fontSize: 13, color: c.textSecondary },
    changeLine: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, minHeight: 24 },
    badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 9 },
    change: {
      fontSize: 12,
      fontFamily: th.typography.fontFamily.semibold,
      writingDirection: 'ltr',
    },
    since: { color: c.textMuted, fontSize: 10 },
    lower: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, minHeight: 44 },
    cash: { flex: 1, alignItems: 'flex-end', gap: 2 },
    cashValue: { flexDirection: 'row-reverse', alignItems: 'baseline', gap: 5 },
    cashNumber: { fontSize: 15, fontFamily: th.typography.fontFamily.semibold },
    cashUnit: { fontSize: 10, color: c.textMuted },
    historyNote: { flex: 1, fontSize: 10, color: c.textMuted, textAlign: 'left' },
  }));
  const sign = (model.changePct ?? 0) >= 0;
  const trendColor = sign ? colors.income : colors.warning;
  return (
    <View style={styles.root} testID="portfolio-summary">
      <View style={styles.heading}>
        <PressScale
          onPress={onHide}
          accessibilityRole="button"
          accessibilityLabel={hidden ? dict.home.showAmounts : dict.home.hideAmounts}
          accessibilityState={{ selected: hidden }}
          style={styles.hide}>
          {hidden ? (
            <EyeOff size={18} color={colors.textSecondary} />
          ) : (
            <Eye size={18} color={colors.textSecondary} />
          )}
        </PressScale>
        <AppText style={styles.caption}>{dict.home.totalAssets}</AppText>
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
        <View style={styles.changeLine}>
          <View style={[styles.badge, { backgroundColor: sign ? p.positive : p.gold[0] }]}>
            <AppText style={[styles.change, { color: trendColor }]}>
              {sign ? '+' : '−'}
              {toPersianDigits(Math.abs(model.changePct).toFixed(1)).replace('.', '٫')}٪
            </AppText>
          </View>
          <AppText style={styles.since}>{dict.home.vsSameTimeLastMonth}</AppText>
        </View>
      ) : null}
      <View style={styles.lower}>
        <PressScale onPress={onOpen} accessibilityRole="button" style={styles.cash}>
          <AppText style={styles.caption}>{dict.home.cashAndBank}</AppText>
          <View style={styles.cashValue}>
            <MoneyText align="right" style={styles.cashNumber}>
              {hidden ? '••••' : formatTomanFromRial(model.cashRial, { sign: model.cashRial < 0 })}
            </MoneyText>
            <AppText style={styles.cashUnit}>{displayUnitLabel()}</AppText>
          </View>
        </PressScale>
        {!hidden && model.trend.length >= 2 ? (
          <WealthTrend
            values={model.trend}
            color={trendColor}
            width={Math.min(162, width * 0.39)}
            height={44}
          />
        ) : !hidden ? (
          <AppText style={styles.historyNote}>{dict.home.historyHint}</AppText>
        ) : null}
      </View>
    </View>
  );
}
