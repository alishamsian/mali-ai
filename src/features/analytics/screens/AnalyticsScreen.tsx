import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, type RefreshControlProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { AppText } from '../../../components/ui/AppText';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { PressScale } from '../../../components/ui/PressScale';
import { EmptyState } from '../../../components/feedback/EmptyState';
import {
  CompareLineChart,
  CURRENT_LINE,
  PREVIOUS_LINE,
} from '../../../components/charts/CompareLineChart';
import { MonthOutlook } from '../components/MonthOutlook';
import { categoryIcons } from '../../../components/lists/TransactionRow';
import { t, interpolate } from '../../../i18n';
import { formatTomanFromRial } from '../../../utils/currency/money';
import { toPersianDigits } from '../../../utils/numbers/digits';
import { jalaliDayKey, shiftJalaliDayKey, todayJalaliKey, toJalaliMonthYear } from '../../../utils/dates/jalali';
import { useFinanceStore } from '../../../store/finance/store';
import { categoryTotals, isExpenseLike, percentChange } from '../../../engine/insights/analytics';
import {
  JALALI_MONTHS,
  monthsSpendSeries,
  weekSpendSeries,
} from '../../../engine/insights/spendSeries';
import type { CategoryId, Transaction } from '../../../types/finance';
import type { RootStackParamList } from '../../../app/navigation/types';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { theme } from '../../../theme';

type Period = 'week' | 'months';
const PERIODS: Period[] = ['week', 'months'];
const MAX_CATEGORIES = 6;

function inKeys(transactions: Transaction[], keys: Set<string>): Transaction[] {
  return transactions.filter(tx => isExpenseLike(tx) && keys.has(jalaliDayKey(tx.transactionDate)));
}

export function AnalyticsScreen({
  embedded = false,
  refreshControl,
}: {
  embedded?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useAppTheme();
  const dict = t();
  const snapshot = useFinanceStore(s => s.snapshot);
  const hidden = snapshot.settings.hideBalances;
  const [period, setPeriod] = useState<Period>('week');
  const todayKey = todayJalaliKey();

  const series = useMemo(
    () =>
      period === 'week'
        ? weekSpendSeries(snapshot.transactions, todayKey)
        : monthsSpendSeries(snapshot.transactions, todayKey),
    [snapshot.transactions, period, todayKey],
  );
  const [selected, setSelected] = useState<number | null>(null);
  const sel = selected ?? series.todayIndex;

  // Headline: this week so far vs last week to the same day; or this month vs last month.
  const headline = useMemo(() => {
    if (period === 'week') {
      return { total: series.currentTotal, previous: series.previousToDate };
    }
    const last = series.points[series.points.length - 1];
    const before = series.points[series.points.length - 2];
    return { total: last?.current ?? 0, previous: before?.current ?? 0 };
  }, [period, series]);
  const delta = percentChange(headline.total, headline.previous);
  const deltaLabel =
    headline.previous === 0
      ? null
      : Math.abs(delta) < 1
        ? dict.analytics.deltaFlat
        : interpolate(
            delta < 0
              ? period === 'week'
                ? dict.analytics.deltaLessWeek
                : dict.analytics.deltaLessMonth
              : period === 'week'
                ? dict.analytics.deltaMoreWeek
                : dict.analytics.deltaMoreMonth,
            { pct: toPersianDigits(Math.round(Math.abs(delta))) },
          );
  const monthName = JALALI_MONTHS[Number(todayKey.split('-')[1]) - 1];

  const categories = useMemo(() => {
    let current: Transaction[];
    let previous: Transaction[];
    if (period === 'week') {
      const offsets = series.points.map((_, i) => i - series.todayIndex).filter(o => o <= 0);
      current = inKeys(snapshot.transactions, new Set(offsets.map(o => shiftJalaliDayKey(todayKey, o))));
      previous = inKeys(snapshot.transactions, new Set(offsets.map(o => shiftJalaliDayKey(todayKey, o - 7))));
    } else {
      // Same calendar-month window as the chart, so list and headline always add up.
      const [y, m] = todayKey.split('-').map(Number);
      const monthKey = `${y}-${String(m).padStart(2, '0')}`;
      const prevKey = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
      const inMonth = (key: string) => (tx: Transaction) =>
        isExpenseLike(tx) && jalaliDayKey(tx.transactionDate).startsWith(key);
      current = snapshot.transactions.filter(inMonth(monthKey));
      previous = snapshot.transactions.filter(inMonth(prevKey));
    }
    const cur = categoryTotals(current);
    const prev = categoryTotals(previous);
    const sum = Object.values(cur).reduce((s, n) => s + n, 0);
    return (Object.entries(cur) as Array<[CategoryId, number]>)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_CATEGORIES)
      .map(([id, rial]) => {
        const before = prev[id] ?? 0;
        const change = before === 0 ? null : percentChange(rial, before);
        return { id, rial, share: sum > 0 ? rial / sum : 0, change };
      });
  }, [period, series, snapshot.transactions, todayKey]);

  const money = (rial: number) => (hidden ? '••••' : formatTomanFromRial(rial));
  const legend =
    period === 'week'
      ? [dict.analytics.legendThisWeek, dict.analytics.legendLastWeek]
      : [dict.analytics.legendThisYear, dict.analytics.legendLastYear];

  const body = (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{
        paddingTop: embedded ? 0 : insets.top + 8,
        paddingBottom: embedded ? 16 : 40,
        paddingHorizontal: embedded ? 0 : 16,
        gap: 14,
      }}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled={embedded}
      refreshControl={refreshControl}>
      {!embedded ? (
        <ScreenHeader
          title={dict.analytics.title}
          subtitle={toJalaliMonthYear(new Date().toISOString())}
          onBack={() => navigation.goBack()}
        />
      ) : null}

      <View style={styles.periodWrap}>
        <SegmentedControl
          options={PERIODS}
          value={period}
          onChange={p => {
            setPeriod(p);
            setSelected(null);
          }}
          labelFor={p => (p === 'week' ? dict.analytics.periodWeek : dict.analytics.periodMonths)}
        />
      </View>

      <View style={styles.headline} accessibilityLiveRegion="polite">
        <AppText style={[styles.caption, { color: colors.textSecondary }]}>
          {period === 'week'
            ? dict.analytics.captionWeek
            : interpolate(dict.analytics.captionMonth, { month: monthName })}
        </AppText>
        <View style={styles.totalRow}>
          <AppText style={[styles.unit, { color: colors.textSecondary }]}>{dict.common.toman}</AppText>
          <AppText style={[styles.total, { color: colors.text }]} adjustsFontSizeToFit numberOfLines={1}>
            {money(headline.total)}
          </AppText>
        </View>
        {deltaLabel && !hidden ? (
          <View style={[styles.deltaChip, { backgroundColor: colors.highlight }]}>
            <AppText style={[styles.deltaText, { color: colors.onHighlight }]}>{deltaLabel}</AppText>
          </View>
        ) : null}
      </View>

      <View>
        <CompareLineChart points={series.points} selected={sel} onSelect={setSelected} formatValue={money} />
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: CURRENT_LINE }]} />
            <AppText style={[styles.legendText, { color: colors.textSecondary }]}>{legend[0]}</AppText>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDash, { borderColor: PREVIOUS_LINE }]} />
            <AppText style={[styles.legendText, { color: colors.textSecondary }]}>{legend[1]}</AppText>
          </View>
        </View>
      </View>

      <MonthOutlook hidden={hidden} />

      <GlassPanel radius={30} style={styles.listPanel}>
        <View style={styles.pillWrap} pointerEvents="none">
          <GlassPanel strong radius={999} style={styles.pill}>
            <AppText style={[styles.pillText, { color: colors.text }]}>
              {period === 'week' ? dict.analytics.listThisWeek : monthName}
            </AppText>
          </GlassPanel>
        </View>
        {categories.length === 0 ? (
          <EmptyState title={dict.analytics.emptyPeriod} />
        ) : (
          categories.map(c => {
            const Icon = categoryIcons[c.id];
            const up = c.change !== null && c.change >= 1;
            const down = c.change !== null && c.change <= -1;
            const trend =
              c.change === null
                ? dict.analytics.trendNew
                : `${up ? '↑' : down ? '↓' : ''}${toPersianDigits(Math.round(Math.abs(c.change)))}٪`;
            return (
              <PressScale
                key={c.id}
                onPress={() => navigation.navigate('Transactions')}
                accessibilityLabel={`${dict.categories[c.id]}، ${money(c.rial)}`}>
                <GlassPanel strong radius={20} style={styles.catRow}>
                  <View style={[styles.catIcon, { backgroundColor: colors.backgroundElevated }]}>
                    <Icon color={colors.text} size={20} strokeWidth={1.9} />
                  </View>
                  <View style={styles.catMeta}>
                    <AppText style={[styles.catName, { color: colors.text }]}>{dict.categories[c.id]}</AppText>
                    <View style={styles.shareLine}>
                      <View style={[styles.shareTrack, { backgroundColor: 'rgba(17,19,22,0.1)' }]}>
                        <View
                          style={[styles.shareFill, { width: `${Math.round(c.share * 100)}%`, backgroundColor: colors.text }]}
                        />
                      </View>
                      <AppText style={[styles.shareText, { color: colors.textMuted }]}>
                        {interpolate(dict.analytics.shareOfTotal, { pct: toPersianDigits(Math.round(c.share * 100)) })}
                        {' · '}
                        <AppText style={[styles.trend, { color: up ? colors.warning : down ? colors.income : colors.textMuted }]}>
                          {trend}
                        </AppText>
                      </AppText>
                    </View>
                  </View>
                  <AppText style={[styles.catAmount, { color: colors.text }]}>{money(c.rial)}</AppText>
                </GlassPanel>
              </PressScale>
            );
          })
        )}
      </GlassPanel>
    </ScrollView>
  );

  if (embedded) {
    return body;
  }
  return <NightCanvas>{body}</NightCanvas>;
}

const rtl = { textAlign: 'right' as const, writingDirection: 'rtl' as const };

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  periodWrap: { alignSelf: 'center', width: 220 },
  headline: { alignItems: 'center', gap: 6 },
  caption: { fontSize: 13, textAlign: 'center', writingDirection: 'rtl' },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, maxWidth: '100%' },
  total: {
    fontSize: 44,
    lineHeight: 58,
    letterSpacing: -1,
    fontFamily: theme.typography.fontFamily.semibold,
    writingDirection: 'ltr',
    flexShrink: 1,
  },
  unit: { fontSize: 14 },
  deltaChip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  deltaText: { fontSize: 13, fontFamily: theme.typography.fontFamily.bold },
  legend: { flexDirection: 'row-reverse', justifyContent: 'center', gap: 18, marginTop: 2 },
  legendItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 16, height: 3, borderRadius: 2 },
  legendDash: { width: 16, height: 0, borderTopWidth: 2, borderStyle: 'dashed' },
  legendText: { fontSize: 12 },
  listPanel: { paddingTop: 26, paddingHorizontal: 10, paddingBottom: 10, gap: 8, marginTop: 10 },
  pillWrap: { position: 'absolute', top: -14, left: 0, right: 0, alignItems: 'center' },
  pill: { paddingHorizontal: 14, paddingVertical: 4 },
  pillText: { fontSize: 12, fontFamily: theme.typography.fontFamily.semibold },
  catRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12 },
  catIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  catMeta: { flex: 1, gap: 4, alignItems: 'flex-end' },
  catName: { ...rtl, fontSize: 15, fontFamily: theme.typography.fontFamily.semibold },
  shareLine: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  shareTrack: { width: 56, height: 4, borderRadius: 2, overflow: 'hidden' },
  shareFill: { height: 4, borderRadius: 2 },
  shareText: { ...rtl, fontSize: 12 },
  trend: { fontSize: 12, fontFamily: theme.typography.fontFamily.semibold },
  catAmount: { fontSize: 15, fontFamily: theme.typography.fontFamily.semibold },
});
