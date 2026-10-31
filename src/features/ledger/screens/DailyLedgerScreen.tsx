import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Share2,
  SlidersHorizontal,
} from 'lucide-react-native';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { AppText } from '../../../components/ui/AppText';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { TransactionRow } from '../../../components/lists/TransactionRow';
import { SwipeTxRow } from '../../../components/lists/SwipeTxRow';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { FilterChip } from '../../../components/ui/FilterChip';
import { PressScale } from '../../../components/ui/PressScale';
import { MoneyText } from '../../../components/ui/MoneyText';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { Skeleton } from '../../../components/ui/Skeleton';
import { appAlert, appToast } from '../../../components/ui/AppAlert';
import { CATEGORY_COLOR } from '../../../theme/accents';
import { interpolate, t } from '../../../i18n';
import { formatTomanLabel } from '../../../utils/currency/money';
import { jalaliDayLabel, jalaliWeekdayShort } from '../../../utils/dates/jalali';
import { toPersianDigits } from '../../../utils/numbers/digits';
import { useFinanceStore } from '../../../store/finance/store';
import {
  buildDayRangeSummaries,
  dayInsightLine,
  dayShareText,
  dailySpendAllowance,
  expenseSeries,
  filterDayTransactions,
  monthToDateNet,
  reviewCountForDay,
  shiftDayKey,
  sortDayTransactions,
  summarizeDay,
  transactionsForDay,
  weekExpenseAverage,
  type DayFilter,
  type DaySort,
} from '../../../engine/insights/dailyLedger';
import type { CategoryId, Transaction } from '../../../types/finance';
import type { RootStackParamList } from '../../../app/navigation/types';
import { DaySummaryCard } from '../components/DaySummaryCard';
import { useLedgerDay } from '../hooks/useLedgerDay';

const FILTERS: DayFilter[] = ['all', 'income', 'expense', 'transfer', 'sms'];
const SORTS: DaySort[] = ['time_desc', 'time_asc', 'amount_desc', 'amount_asc'];

export function DailyLedgerScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors, mode } = useAppTheme();
  const dict = t();
  const snapshot = useFinanceStore(s => s.snapshot);
  const hydrated = useFinanceStore(s => s.hydrated);
  const updateSettings = useFinanceStore(s => s.updateSettings);
  const runSmsSync = useFinanceStore(s => s.runIncrementalSmsSync);
  const { dayKey, today, now, selectDay, goToday, refreshDate } = useLedgerDay();
  const hidden = snapshot.settings.hideBalances;
  const currency = snapshot.settings.displayCurrency ?? 'IRT';
  const isToday = dayKey === today;
  const [filter, setFilter] = useState<DayFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | 'all'>('all');
  const [sort, setSort] = useState<DaySort>('time_desc');
  const [refreshing, setRefreshing] = useState(false);
  const refreshPending = useRef(false);
  const sharing = useRef(false);

  const styles = useThemedStyles((c, th) => ({
    header: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
    },
    title: { fontSize: 24, color: c.text, fontFamily: th.typography.fontFamily.semibold },
    icons: { flexDirection: 'row', gap: 2 },
    icon: {
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 15,
    },
    dateNav: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 6,
      marginHorizontal: 16,
      marginTop: 6,
    },
    dateCenter: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 1 },
    dateLabel: {
      color: c.text,
      fontSize: 14,
      textAlign: 'center',
      fontFamily: th.typography.fontFamily.semibold,
    },
    today: { fontSize: 10, color: c.primary, textAlign: 'center' },
    strip: {
      flexDirection: 'row-reverse',
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 12,
      gap: 6,
    },
    chip: {
      flex: 1,
      minWidth: 0,
      minHeight: 60,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      backgroundColor: c.glass,
    },
    chipOn: { backgroundColor: c.primary },
    weekday: { fontSize: 10, lineHeight: 14, color: c.textMuted },
    dayNum: { fontSize: 15, color: c.text, fontFamily: th.typography.fontFamily.semibold },
    dot: { width: 4, height: 4, borderRadius: 2 },
    pad: { marginHorizontal: 16, marginTop: 12 },
    listHead: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginHorizontal: 16,
      marginTop: 8,
    },
    sectionTitle: {
      fontSize: 14,
      color: c.text,
      textAlign: 'right',
      fontFamily: th.typography.fontFamily.semibold,
    },
    muted: { color: c.textMuted, fontSize: 11, lineHeight: 20, textAlign: 'right' },
    sort: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 5,
      minHeight: 44,
      paddingHorizontal: 8,
    },
    row: { marginHorizontal: 16, paddingHorizontal: 8, backgroundColor: c.glass },
    rowFirst: { borderTopLeftRadius: 20, borderTopRightRadius: 20 },
    rowLast: { borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
    empty: { marginHorizontal: 16, marginTop: 8, padding: 20, gap: 10 },
    filterReset: {
      flexDirection: 'row-reverse',
      gap: 8,
      flexWrap: 'wrap',
      marginHorizontal: 16,
      marginTop: 6,
    },
    footer: { marginHorizontal: 16, marginTop: 14, gap: 12 },
    detail: { padding: 14, gap: 10 },
    category: { gap: 7, paddingVertical: 8, minHeight: 44 },
    categoryHead: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
    categoryName: { flex: 1, textAlign: 'right', fontSize: 12, color: c.text },
    categoryMoney: { maxWidth: '55%', fontSize: 12, color: c.textSecondary },
    track: {
      height: 4,
      borderRadius: 4,
      backgroundColor: c.border,
      overflow: 'hidden',
      flexDirection: 'row-reverse',
    },
    notice: { minHeight: 44, justifyContent: 'center', padding: 12 },
    veil: { backgroundColor: 'rgba(255,255,255,0.38)' },
  }));

  const rawDayTx = useMemo(
    () => transactionsForDay(snapshot.transactions, dayKey),
    [snapshot.transactions, dayKey],
  );
  const summary = useMemo(
    () => summarizeDay(snapshot.transactions, dayKey),
    [snapshot.transactions, dayKey],
  );
  const weekStrip = useMemo(
    () => buildDayRangeSummaries(snapshot.transactions, dayKey, 3),
    [snapshot.transactions, dayKey],
  );
  const monthlyNet = useMemo(
    () => monthToDateNet(snapshot.transactions, dayKey, snapshot.settings, now),
    [snapshot.transactions, snapshot.settings, dayKey, now],
  );
  const budgetHint = useMemo(
    () =>
      dailySpendAllowance(
        {
          transactions: snapshot.transactions,
          budgets: snapshot.budgets,
          settings: snapshot.settings,
        },
        dayKey,
        now,
      ),
    [snapshot.transactions, snapshot.budgets, snapshot.settings, dayKey, now],
  );
  const reviewCount = useMemo(
    () => reviewCountForDay(snapshot.transactions, dayKey),
    [snapshot.transactions, dayKey],
  );
  const filteredDay = useMemo(() => filterDayTransactions(rawDayTx, filter), [rawDayTx, filter]);
  const rows = useMemo(
    () =>
      sortDayTransactions(
        categoryFilter === 'all'
          ? filteredDay
          : filteredDay.filter(tx => tx.categoryId === categoryFilter),
        sort,
      ),
    [filteredDay, categoryFilter, sort],
  );
  const categories = useMemo(
    () =>
      summarizeDay(filteredDay, dayKey)
        .categories.filter(c => c.expenseRial > 0)
        .sort((a, b) => b.expenseRial - a.expenseRial),
    [filteredDay, dayKey],
  );
  const trend = useMemo(
    () => expenseSeries(snapshot.transactions, dayKey, 7),
    [snapshot.transactions, dayKey],
  );
  const trendLabels = useMemo(
    () => trend.map((_, i) => jalaliWeekdayShort(shiftDayKey(dayKey, i - 6))),
    [trend, dayKey],
  );
  const insight = useMemo(
    () =>
      dayInsightLine(
        summary,
        summarizeDay(snapshot.transactions, shiftDayKey(dayKey, -1)),
        isToday,
        isToday ? weekExpenseAverage(snapshot.transactions, dayKey) : null,
      ),
    [summary, snapshot.transactions, dayKey, isToday],
  );
  let insightText: string | null = null;
  if (!hidden && insight) {
    switch (insight.code) {
      case 'weekFlat':
        insightText = dict.daily.vsWeekFlat;
        break;
      case 'weekMore':
      case 'weekLess':
        insightText = interpolate(
          dict.daily[insight.code === 'weekMore' ? 'vsWeekMore' : 'vsWeekLess'],
          {
            amount: formatTomanLabel(insight.vars.amount as number, { displayCurrency: currency }),
          },
        );
        break;
      case 'yesterdayFlat':
        insightText = dict.daily.vsYesterdayFlat;
        break;
      default:
        insightText = `${interpolate(dict.daily.vsYesterday, { pct: insight.vars.pct })} · ${
          insight.code === 'yesterdayUp' ? dict.daily.vsYesterdayUp : dict.daily.vsYesterdayDown
        }`;
    }
  }

  const openAdd = useCallback(
    () => navigation.navigate('AddTransaction', { mode: 'expense', dayKey }),
    [navigation, dayKey],
  );
  const clearFilters = () => {
    setFilter('all');
    setCategoryFilter('all');
  };
  const onRefresh = useCallback(async () => {
    if (refreshPending.current) {
      return;
    }
    refreshPending.current = true;
    refreshDate();
    setRefreshing(true);
    try {
      if (snapshot.settings.smsProcessingEnabled) {
        await runSmsSync();
      }
    } catch {
      appToast(dict.daily.refreshError);
    } finally {
      refreshPending.current = false;
      setRefreshing(false);
    }
  }, [dict.daily.refreshError, refreshDate, runSmsSync, snapshot.settings.smsProcessingEnabled]);
  const share = async () => {
    if (sharing.current) {
      return;
    }
    sharing.current = true;
    try {
      await Share.share({
        title: dict.daily.title,
        message: dayShareText(
          summary,
          jalaliDayLabel(dayKey),
          {
            income: dict.daily.income,
            expense: dict.daily.expense,
            net: dict.daily.cashFlow,
            transfer: dict.daily.ownTransfers,
            count: dict.daily.txCount,
            refund: dict.daily.refund,
          },
          { hidden, displayCurrency: currency },
        ),
      });
    } catch {
      appToast(dict.daily.shareError);
    } finally {
      sharing.current = false;
    }
  };
  const hasFilter = filter !== 'all' || categoryFilter !== 'all';
  const renderItem = ({ item, index }: { item: Transaction; index: number }) => (
    <View
      style={[
        styles.row,
        index === 0 && styles.rowFirst,
        index === rows.length - 1 && styles.rowLast,
      ]}>
      <SwipeTxRow tx={item}>
        <TransactionRow
          tx={item}
          hidden={hidden}
          grouped
          isLast={index === rows.length - 1}
          onPress={() => navigation.navigate('TransactionDetails', { id: item.id })}
        />
      </SwipeTxRow>
    </View>
  );

  if (!hydrated) {
    return (
      <NightCanvas>
        <View style={[styles.pad, { paddingTop: insets.top + 12, gap: 12 }]}>
          <Skeleton height={40} />
          <Skeleton height={60} />
          <Skeleton height={160} />
          <Skeleton height={120} />
        </View>
      </NightCanvas>
    );
  }

  return (
    <NightCanvas>
      {mode === 'light' ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.veil]} />
      ) : null}
      <FlatList
        data={rows}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: insets.bottom + 110 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <AppText style={styles.title}>{dict.daily.title}</AppText>
              <View style={styles.icons}>
                <PressScale
                  style={styles.icon}
                  accessibilityRole="button"
                  accessibilityLabel={dict.daily.viewCalendar}
                  onPress={() =>
                    navigation.navigate('Analytics', {
                      section: 'calendar',
                      calendarDayKey: dayKey,
                    })
                  }>
                  <CalendarDays size={19} color={colors.text} />
                </PressScale>
                <PressScale
                  style={styles.icon}
                  accessibilityRole="button"
                  accessibilityLabel={dict.daily.share}
                  onPress={() => void share()}>
                  <Share2 size={19} color={colors.text} />
                </PressScale>
                <PressScale
                  style={styles.icon}
                  accessibilityRole="button"
                  accessibilityLabel={hidden ? dict.home.showAmounts : dict.home.hideAmounts}
                  onPress={() => updateSettings({ hideBalances: !hidden })}>
                  {hidden ? (
                    <EyeOff size={19} color={colors.text} />
                  ) : (
                    <Eye size={19} color={colors.text} />
                  )}
                </PressScale>
              </View>
            </View>
            <View style={styles.dateNav}>
              <PressScale
                style={styles.icon}
                accessibilityRole="button"
                accessibilityLabel={dict.daily.previousDay}
                onPress={() => selectDay(shiftDayKey(dayKey, -1))}>
                <ChevronRight color={colors.textSecondary} size={21} />
              </PressScale>
              <PressScale
                style={styles.dateCenter}
                accessibilityRole="button"
                accessibilityLabel={`${jalaliDayLabel(dayKey)}، ${
                  isToday ? dict.daily.todayBadge : dict.daily.tapToday
                }`}
                onPress={goToday}>
                <AppText style={styles.dateLabel}>{jalaliDayLabel(dayKey)}</AppText>
                <AppText style={styles.today}>
                  {isToday ? dict.daily.todayBadge : dict.daily.tapToday}
                </AppText>
              </PressScale>
              <PressScale
                style={styles.icon}
                accessibilityRole="button"
                accessibilityLabel={dict.daily.nextDay}
                onPress={() => selectDay(shiftDayKey(dayKey, 1))}>
                <ChevronLeft color={colors.textSecondary} size={21} />
              </PressScale>
            </View>
            <View style={styles.strip}>
              {weekStrip.map(day => {
                const active = day.key === dayKey;
                const textColor = active ? colors.onPrimary : colors.text;
                return (
                  <PressScale
                    key={day.key}
                    testID={`daily-day-${day.key}`}
                    style={[styles.chip, active && styles.chipOn]}
                    accessibilityRole="button"
                    accessibilityLabel={`${jalaliDayLabel(day.key)}${
                      day.key === today ? `، ${dict.daily.todayBadge}` : ''
                    }`}
                    accessibilityState={{ selected: active }}
                    onPress={() => selectDay(day.key)}>
                    <AppText style={[styles.weekday, active && { color: textColor }]}>
                      {jalaliWeekdayShort(day.key)}
                    </AppText>
                    <AppText style={[styles.dayNum, { color: textColor }]}>
                      {toPersianDigits(Number(day.key.split('-')[2]))}
                    </AppText>
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: day.txCount ? textColor : 'transparent' },
                      ]}
                    />
                  </PressScale>
                );
              })}
            </View>
            <DaySummaryCard
              summary={summary}
              monthlyNet={monthlyNet}
              budgetHint={budgetHint}
              hidden={hidden}
              currency={currency}
              isToday={isToday}
              trend={trend}
              trendLabels={trendLabels}
              insight={insightText}
            />
            <View style={styles.pad}>
              <PrimaryButton label={dict.daily.addTransaction} onPress={openAdd} />
            </View>
            {reviewCount > 0 ? (
              <View style={styles.pad}>
                <PressScale
                  style={styles.notice}
                  accessibilityRole="button"
                  onPress={() => navigation.navigate('ReviewInbox')}>
                  <AppText style={styles.muted}>
                    {interpolate(dict.daily.reviewDayChip, { n: reviewCount })}
                  </AppText>
                </PressScale>
              </View>
            ) : null}
            <View style={styles.pad}>
              <SegmentedControl
                options={FILTERS}
                value={filter}
                labelFor={id => (id === 'sms' ? dict.daily.sms : dict.daily[id])}
                onChange={value => {
                  setFilter(value);
                  setCategoryFilter('all');
                }}
              />
            </View>
            {hasFilter ? (
              <View style={styles.filterReset}>
                <FilterChip label={dict.daily.clearFilters} active onPress={clearFilters} />
                {categoryFilter !== 'all' ? (
                  <FilterChip
                    label={dict.categories[categoryFilter]}
                    active
                    onPress={() => setCategoryFilter('all')}
                  />
                ) : null}
              </View>
            ) : null}
            <View style={styles.listHead}>
              <AppText style={styles.sectionTitle}>
                {interpolate(dict.daily.txCount, { count: rows.length })}
              </AppText>
              <PressScale
                style={styles.sort}
                accessibilityRole="button"
                accessibilityLabel={`${dict.daily.sortBy}: ${dict.daily[sort]}`}
                onPress={() =>
                  appAlert(dict.daily.sortBy, undefined, [
                    ...SORTS.map(id => ({ text: dict.daily[id], onPress: () => setSort(id) })),
                    { text: dict.common.cancel, style: 'cancel' },
                  ])
                }>
                <SlidersHorizontal size={14} color={colors.textMuted} />
                <AppText style={styles.muted}>{dict.daily[sort]}</AppText>
              </PressScale>
            </View>
            {hasFilter ? (
              <View style={{ marginHorizontal: 16, marginBottom: 8 }}>
                <AppText style={styles.muted}>{dict.daily.filterScope}</AppText>
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          <GlassPanel radius={20} style={styles.empty}>
            <AppText style={styles.sectionTitle}>
              {rawDayTx.length ? dict.daily.filterEmpty : dict.daily.empty}
            </AppText>
            <AppText style={styles.muted}>
              {rawDayTx.length ? dict.daily.filterEmptyHint : dict.daily.emptyHint}
            </AppText>
            {rawDayTx.length ? (
              <PrimaryButton label={dict.daily.clearFilters} onPress={clearFilters} />
            ) : null}
          </GlassPanel>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {categories.length ? (
              <GlassPanel testID="daily-expense-categories" radius={20} style={styles.detail}>
                <AppText style={styles.sectionTitle}>{dict.daily.byCategory}</AppText>
                {categories.map(category => (
                  <PressScale
                    key={category.categoryId}
                    style={styles.category}
                    accessibilityRole="button"
                    accessibilityLabel={`${dict.categories[category.categoryId]}، ${
                      hidden
                        ? dict.home.amountHidden
                        : formatTomanLabel(category.expenseRial, { displayCurrency: currency })
                    }`}
                    accessibilityState={{ selected: categoryFilter === category.categoryId }}
                    onPress={() =>
                      setCategoryFilter(value =>
                        value === category.categoryId ? 'all' : category.categoryId,
                      )
                    }>
                    <View style={styles.categoryHead}>
                      <View
                        style={[
                          styles.dot,
                          { backgroundColor: CATEGORY_COLOR[category.categoryId] },
                        ]}
                      />
                      <AppText style={styles.categoryName}>
                        {dict.categories[category.categoryId]}
                      </AppText>
                      <MoneyText align="left" style={styles.categoryMoney}>
                        {hidden
                          ? '••••'
                          : formatTomanLabel(category.expenseRial, { displayCurrency: currency })}
                      </MoneyText>
                    </View>
                    {!hidden ? (
                      <View style={styles.track}>
                        <View
                          style={{
                            height: 4,
                            width: `${Math.round(
                              (category.expenseRial / categories[0].expenseRial) * 100,
                            )}%`,
                            backgroundColor: CATEGORY_COLOR[category.categoryId],
                          }}
                        />
                      </View>
                    ) : null}
                  </PressScale>
                ))}
              </GlassPanel>
            ) : null}
          </View>
        }
      />
    </NightCanvas>
  );
}
