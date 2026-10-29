import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { AppText } from '../../../components/ui/AppText';
import { Sparkline } from '../../../components/charts/Charts';
import { formatTomanFromRial } from '../../../utils/currency/money';
import { theme } from '../../../theme';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { useFinanceStore } from '../../../store/finance/store';
import { t } from '../../../i18n';
import { toPersianDigits } from '../../../utils/numbers/digits';
import type { NetWorthSnapshot, WealthRange } from '../../../types/wealth';
import type { PortfolioSummary } from '../engine/portfolio';

export const RANGES: WealthRange[] = ['1D', '1W', '1M', '3M', '6M', '1Y', 'ALL'];

export function NetWorthHero({
  summary,
  history,
  range,
  onRangeChange,
  ranges = RANGES,
  changePct,
  hidden,
}: {
  summary: PortfolioSummary;
  history: NetWorthSnapshot[];
  range: WealthRange;
  onRangeChange: (r: WealthRange) => void;
  /** Ranges with enough history to draw; the others are left out. */
  ranges?: WealthRange[];
  changePct: number | null;
  hidden: boolean;
}) {
  const dict = t();
  const { colors, mode } = useAppTheme();
  const isLight = mode === 'light';
  const reduced = useFinanceStore(s => s.snapshot.settings.reducedMotion);
  const enter = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    enter.value = withSpring(1, { damping: 18, stiffness: 140 });
  }, [enter]);
  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: interpolate(enter.value, [0, 1], [10, 0]) }],
  }));

  const styles = useThemedStyles((c, th) => ({
    shell: {
      marginHorizontal: 16,
      marginBottom: 14,
      borderRadius: 26,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: isLight ? c.glassBorder : 'rgba(94,234,212,0.18)',
    },
    hero: {
      paddingHorizontal: 18,
      paddingTop: 22,
      paddingBottom: 16,
    },
    caption: {
      textAlign: 'center',
      alignSelf: 'stretch',
      color: c.textMuted,
      fontSize: 13,
      letterSpacing: 0.3,
    },
    amount: {
      textAlign: 'center',
      alignSelf: 'stretch',
      marginTop: 10,
      fontSize: 36,
      lineHeight: 44,
      fontFamily: th.typography.fontFamily.semibold,
      color: c.text,
      writingDirection: 'ltr',
    },
    currency: {
      textAlign: 'center',
      alignSelf: 'stretch',
      marginTop: 2,
      fontSize: 12,
      color: c.textMuted,
    },
    changePill: {
      alignSelf: 'center',
      marginTop: 12,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: isLight ? 'rgba(8,13,16,0.04)' : 'rgba(255,255,255,0.05)',
      borderWidth: 1,
      borderColor: isLight ? c.border : 'rgba(255,255,255,0.08)',
    },
    change: {
      textAlign: 'center',
      fontSize: 13,
      fontFamily: th.typography.fontFamily.semibold,
    },
    changeMuted: {
      textAlign: 'center',
      fontSize: 12,
      color: c.textMuted,
    },
    tri: {
      flexDirection: 'row',
      marginTop: 18,
      gap: 8,
    },
    triItem: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 11,
      paddingHorizontal: 4,
      borderRadius: 16,
      backgroundColor: isLight ? 'rgba(8,13,16,0.04)' : 'rgba(255,255,255,0.045)',
      borderWidth: 1,
      borderColor: isLight ? c.border : 'rgba(255,255,255,0.06)',
    },
    triLabel: {
      fontSize: 10,
      color: c.textMuted,
      marginBottom: 4,
      textAlign: 'center',
    },
    triValue: {
      fontSize: 12,
      fontFamily: th.typography.fontFamily.semibold,
      color: c.text,
      textAlign: 'center',
      writingDirection: 'ltr',
    },
    chart: { alignItems: 'center', marginTop: 14 },
    ranges: {
      flexDirection: 'row',
      justifyContent: 'center',
      flexWrap: 'wrap',
      gap: 4,
      marginTop: 12,
    },
    range: {
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 10,
    },
    rangeText: { fontSize: 11, color: c.textMuted, textAlign: 'center' },
  }));
  const points = history.map(h => h.netWorthRial);
  const up = (changePct ?? 0) >= 0;
  const heroGradient = isLight
    ? ['rgba(255,255,255,0.62)', 'rgba(255,255,255,0.5)', 'rgba(255,255,255,0.42)']
    : ['rgba(18, 40, 44, 0.98)', 'rgba(10, 22, 26, 0.98)', 'rgba(14, 28, 24, 0.96)'];

  return (
    <Animated.View style={[styles.shell, enterStyle]}>
      <LinearGradient
        colors={heroGradient}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.hero}>
        <AppText style={styles.caption}>{dict.wealth.netWorth}</AppText>
        <AppText style={styles.amount}>
          {hidden ? '••••••••' : formatTomanFromRial(summary.netWorthRial)}
        </AppText>
        <AppText style={styles.currency}>{dict.common.toman}</AppText>

        <View style={styles.changePill}>
          {changePct != null && Math.abs(changePct) >= 0.05 ? (
            <AppText style={[styles.change, { color: up ? colors.income : colors.expense }]}>
              {up ? '▲ ' : '▼ '}
              {toPersianDigits(Math.abs(changePct).toFixed(1))}٪ · {dict.wealth.rangeLabels[range]}
            </AppText>
          ) : (
            <AppText style={styles.changeMuted}>{dict.wealth.noHistoryYet}</AppText>
          )}
        </View>

        <View style={styles.tri}>
          <View style={styles.triItem}>
            <AppText style={styles.triLabel}>{dict.wealth.totalAssets}</AppText>
            <AppText style={styles.triValue}>
              {hidden ? '••••' : formatTomanFromRial(summary.totalAssetsRial)}
            </AppText>
          </View>
          <View style={styles.triItem}>
            <AppText style={styles.triLabel}>{dict.wealth.totalLiabilities}</AppText>
            <AppText style={styles.triValue}>
              {hidden ? '••••' : formatTomanFromRial(summary.totalLiabilitiesRial)}
            </AppText>
          </View>
          <View style={styles.triItem}>
            <AppText style={styles.triLabel}>{dict.wealth.liquid}</AppText>
            <AppText style={styles.triValue}>
              {hidden ? '••••' : formatTomanFromRial(summary.liquidRial)}
            </AppText>
          </View>
        </View>

        {points.length >= 2 ? (
          <View style={styles.chart}>
            <Sparkline
              points={points}
              color={up ? colors.income : colors.expense}
              width={300}
              height={72}
            />
          </View>
        ) : null}

        <View style={styles.ranges}>
          {ranges.map(r => (
            <Pressable
              key={r}
              onPress={() => onRangeChange(r)}
              style={[
                styles.range,
                range === r && {
                  backgroundColor: isLight ? colors.primary : theme.palette.primaryGlow,
                },
              ]}>
              <AppText
                style={[
                  styles.rangeText,
                  range === r && { color: isLight ? colors.onPrimary : colors.primary },
                ]}>
                {dict.wealth.ranges[r]}
              </AppText>
            </Pressable>
          ))}
        </View>
      </LinearGradient>
    </Animated.View>
  );
}
