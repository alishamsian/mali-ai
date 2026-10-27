import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  View,
  useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Share2,
} from 'lucide-react-native';
import { theme } from '../../../theme';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { AppText } from '../../../components/ui/AppText';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { Surface } from '../../../components/ui/Surface';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { TransactionRow } from '../../../components/lists/TransactionRow';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { FilterChip } from '../../../components/ui/FilterChip';
import { PressScale } from '../../../components/ui/PressScale';
import { CountToman } from '../../../components/ui/CountToman';
import { MoneyText } from '../../../components/ui/MoneyText';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { AlertBanner } from '../../../components/ui/AlertBanner';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Sparkline } from '../../../components/charts/Charts';
import { CATEGORY_COLOR } from '../../../theme/accents';
import { t, interpolate } from '../../../i18n';
import { formatTomanFromRial } from '../../../utils/currency/money';
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
  groupDayTransactions,
  monthToDateNet,
  reviewCountForDay,
  shiftDayKey,
  sortDayTransactions,
  summarizeDay,
  todayKey,
  transactionsForDay,
  weekExpenseAverage,
  type DayFilter,
  type DayGroupBy,
  type DaySort,
} from '../../../engine/insights/dailyLedger';
import type { CategoryId, TransactionSource } from '../../../types/finance';
import type { MainTabParamList, RootStackParamList } from '../../../app/navigation/types';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Daily'>,
  NativeStackNavigationProp<RootStackParamList>
>;

const FILTERS: DayFilter[] = ['all', 'income', 'expense', 'transfer', 'sms'];
const GROUPS: DayGroupBy[] = ['none', 'category', 'account', 'source'];
const SORTS: DaySort[] = ['time_desc', 'time_asc', 'amount_desc', 'amount_asc'];
const STRIP_RADIUS = 14;
/** Day chip width + gap and the strip's side padding — used to centre the selected day. */
const STRIP_CHIP = 52;
const STRIP_GAP = 8;
const STRIP_PAD = 20;

function sourceGroupLabel(
  source: TransactionSource,
  dict: ReturnType<typeof t>,
): string {
  switch (source) {
    case 'android_sms':
      return dict.transactions.autoSms;
    case 'manual':
      return dict.daily.manualSource;
    case 'open_banking':
      return dict.transactions.sourceOpenBanking;
    case 'csv':
      return dict.transactions.sourceCsv;
    case 'ios_message_filter':
      return dict.transactions.sourceIos;
    default:
      return dict.daily.manualSource;
  }
}

export function DailyLedgerScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { width } = useWindowDimensions();
  const { colors, mode, accent } = useAppTheme();
  const isLight = mode === 'light';
  const chipBg = isLight ? colors.glassStrong : 'rgba(255,255,255,0.04)';
  const panelBg = isLight ? colors.glass : 'rgba(255,255,255,0.035)';

  const styles = useThemedStyles((c, th) => ({
    topBar: {
      flexDirection: 'row-reverse',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingHorizontal: 20,
      marginBottom: 14,
    },
    topTitles: { alignItems: 'flex-end', flex: 1 },
    brandTile: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
    },
    brandGlyph: { fontSize: 28, lineHeight: 40, fontFamily: th.typography.fontFamily.bold, color: c.onPrimary },
    title: {
      fontSize: 24,
      fontFamily: th.typography.fontFamily.semibold,
      color: c.text,
    },
    subtitle: { marginTop: 4, fontSize: 12, color: c.textMuted },
    utilityRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 12,
    },
    utilityBtn: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: chipBg,
      borderWidth: 1,
      borderColor: c.border,
    },
    dateNav: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      marginBottom: 12,
      gap: 8,
      paddingHorizontal: 20,
    },
    navBtn: {
      width: 42,
      height: 42,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: chipBg,
    },
    dateCenter: { flex: 1, alignItems: 'center', gap: 4 },
    dateBadgeRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
    todayPill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: isLight ? c.primary : accent.primaryGlow,
      borderWidth: 1,
      borderColor: c.primary,
    },
    todayPillText: {
      fontSize: 10,
      color: isLight ? c.onPrimary : c.primary,
      fontFamily: th.typography.fontFamily.semibold,
    },
    dateLabel: {
      fontSize: 15,
      fontFamily: th.typography.fontFamily.semibold,
      color: c.text,
      textAlign: 'center',
    },
    tapToday: { fontSize: 11, color: c.primary },
    weekdayHint: { fontSize: 11, color: c.textMuted },
    strip: { flexDirection: 'row-reverse', gap: 8, paddingHorizontal: 20, marginBottom: 14 },
    dayChip: {
      width: 52,
      paddingVertical: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      backgroundColor: chipBg,
      gap: 4,
    },
    dayChipOn: { borderColor: c.primary, backgroundColor: isLight ? c.primary : accent.primaryGlow },
    dayChipToday: { borderColor: `${c.primary}55` },
    dayWeek: { fontSize: 10, color: c.textMuted },
    dayWeekOn: { color: isLight ? c.onPrimary : c.primary },
    dayNum: {
      fontSize: 16,
      fontFamily: th.typography.fontFamily.semibold,
      color: c.text,
    },
    dayNumOn: { color: isLight ? c.onPrimary : c.primary },
    activityDot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
    activityDotEmpty: { backgroundColor: c.border },
    hero: {
      marginHorizontal: 16,
      borderRadius: 30,
      padding: 18,
      borderWidth: 1,
      borderColor: isLight ? c.glassBorder : c.border,
      marginBottom: 12,
    },
    heroTop: {
      flexDirection: 'row-reverse',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    heroKicker: { fontSize: 12, color: c.textMuted },
    mtd: { fontSize: 11, color: c.textMuted },
    heroAmountRow: {
      marginTop: 10,
      flexDirection: 'row-reverse',
      alignItems: 'baseline',
      gap: 8,
      justifyContent: 'center',
    },
    toman: { fontSize: 13, color: c.textMuted },
    vs: { textAlign: 'center', marginTop: 10, fontSize: 12 },
    trendBlock: { marginTop: 14, alignItems: 'center', gap: 6 },
    trendLabel: { fontSize: 10, color: c.textMuted, textAlign: 'right', width: '100%' },
    flowBlock: { marginTop: 16 },
    flowLabel: {
      textAlign: 'right',
      fontSize: 11,
      color: c.textMuted,
      marginBottom: 8,
    },
    flowBar: {
      height: 8,
      borderRadius: 8,
      overflow: 'hidden',
      flexDirection: 'row-reverse',
      backgroundColor: chipBg,
    },
    flowIncome: { backgroundColor: c.income },
    flowExpense: { backgroundColor: c.expense },
    flowStats: { flexDirection: 'row-reverse', marginTop: 14, gap: 10 },
    flowStat: {
      flex: 1,
      minWidth: 0,
      alignItems: 'flex-end',
      padding: 12,
      borderRadius: 14,
      backgroundColor: chipBg,
      borderWidth: 1,
      borderColor: c.border,
    },
    flowStatHead: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
    },
    flowStatLabel: { fontSize: 11, color: c.textMuted },
    flowStatValue: { width: '100%', fontSize: 14 },
    flowCount: { marginTop: 4, fontSize: 10, color: c.textMuted },
    quickRow: {
      flexDirection: 'row-reverse',
      gap: 10,
      paddingHorizontal: 16,
      marginBottom: 14,
    },
    quickExpense: {
      flex: 1,
      minHeight: 52,
      borderRadius: isLight ? 18 : 14,
      borderWidth: 1,
      borderColor: isLight ? c.primary : `${c.expense}55`,
      backgroundColor: isLight ? c.primary : `${c.expense}14`,
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    quickIncome: {
      flex: 1,
      minHeight: 52,
      borderRadius: isLight ? 18 : 14,
      borderWidth: 1,
      borderColor: isLight ? c.glassBorder : `${c.income}55`,
      backgroundColor: isLight ? c.glassStrong : `${c.income}14`,
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    quickText: { fontSize: 13, fontFamily: th.typography.fontFamily.semibold },
    pad: { paddingHorizontal: 16 },
    optionsCard: {
      marginTop: 12,
      padding: 12,
      borderRadius: 16,
      backgroundColor: panelBg,
      borderWidth: 1,
      borderColor: c.border,
      gap: 10,
    },
    optionBlock: { gap: 8 },
    optionLabel: { textAlign: 'right', fontSize: 11, color: c.textMuted },
    chipRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
    catCard: {
      marginTop: 14,
      padding: 14,
      borderRadius: 18,
      backgroundColor: panelBg,
      borderWidth: 1,
      borderColor: c.border,
    },
    sectionTitle: {
      textAlign: 'right',
      fontSize: 14,
      fontFamily: th.typography.fontFamily.semibold,
      color: c.text,
    },
    catRow: { marginTop: 12, gap: 6 },
    catTop: {
      flexDirection: 'row-reverse',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    catMeta: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
    catDot: { width: 8, height: 8, borderRadius: 4 },
    catName: { fontSize: 13, color: c.text },
    catAmt: { fontSize: 12, fontFamily: th.typography.fontFamily.semibold, color: c.textSecondary },
    barBg: {
      height: 5,
      borderRadius: 5,
      backgroundColor: chipBg,
      overflow: 'hidden',
    },
    bar: { height: 5, borderRadius: 5 },
    listHead: { marginTop: 20, marginBottom: 10, alignItems: 'flex-end', gap: 2 },
    listHint: { fontSize: 11, color: c.textMuted },
    listCard: {
      borderRadius: 18,
      backgroundColor: panelBg,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    groupCard: { marginBottom: 10, paddingVertical: 8, paddingHorizontal: 10 },
    groupHead: {
      flexDirection: 'row-reverse',
      justifyContent: 'space-between',
      marginBottom: 6,
      paddingHorizontal: 4,
      gap: 8,
    },
    groupLabel: {
      fontSize: 13,
      fontFamily: th.typography.fontFamily.semibold,
      color: c.text,
      flex: 1,
      textAlign: 'right',
    },
    groupAmt: { fontSize: 12, color: c.textMuted, maxWidth: 120 },
    emptyWrap: { gap: 12, marginTop: 8 },
    skeletonWrap: { paddingHorizontal: 20, gap: 12, paddingTop: 8 },
  }));

  const snapshot = useFinanceStore(s => s.snapshot);
  const hydrated = useFinanceStore(s => s.hydrated);
  const runSmsSync = useFinanceStore(s => s.runIncrementalSmsSync);
  const hidden = snapshot.settings.hideBalances;
  const dict = t();
  const [dayKey, setDayKey] = useState(todayKey());
  const [filter, setFilter] = useState<DayFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | 'all'>('all');
  const [groupBy, setGroupBy] = useState<DayGroupBy>('none');
  const [sort, setSort] = useState<DaySort>('time_desc');
  const [refreshing, setRefreshing] = useState(false);

  const rawDayTx = useMemo(
    () => transactionsForDay(snapshot.transactions, dayKey),
    [snapshot.transactions, dayKey],
  );

  const summary = useMemo(() => summarizeDay(snapshot.transactions, dayKey), [snapshot.transactions, dayKey]);
  const yesterday = useMemo(
    () => summarizeDay(snapshot.transactions, shiftDayKey(dayKey, -1)),
    [snapshot.transactions, dayKey],
  );
  const weekStrip = useMemo(
    () => buildDayRangeSummaries(snapshot.transactions, dayKey, STRIP_RADIUS),
    [snapshot.transactions, dayKey],
  );
  const mtd = useMemo(
    () => monthToDateNet(snapshot.transactions, dayKey),
    [snapshot.transactions, dayKey],
  );
  const isToday = dayKey === todayKey();
  const stripRef = useRef<ScrollView>(null);
  const reviewCount = useMemo(
    () => reviewCountForDay(snapshot.transactions, dayKey),
    [snapshot.transactions, dayKey],
  );
  const spendTrend = useMemo(
    () => expenseSeries(snapshot.transactions, dayKey, 7),
    [snapshot.transactions, dayKey],
  );
  const budgetHint = useMemo(
    () => dailySpendAllowance(snapshot.transactions, snapshot.budgetCategories, dayKey),
    [snapshot.transactions, snapshot.budgetCategories, dayKey],
  );

  const rows = useMemo(() => {
    const scoped =
      categoryFilter === 'all'
        ? rawDayTx
        : rawDayTx.filter(tx => tx.categoryId === categoryFilter);
    const list = filterDayTransactions(scoped, filter);
    return sortDayTransactions(list, sort);
  }, [rawDayTx, categoryFilter, filter, sort]);

  const groups = useMemo(
    () =>
      groupBy === 'none'
        ? []
        : groupDayTransactions(
            rows,
            groupBy,
            id => dict.categories[id],
            id => snapshot.accounts.find(a => a.id === id)?.name ?? id,
          ).map(g =>
            groupBy === 'source'
              ? { ...g, label: sourceGroupLabel(g.id as TransactionSource, dict) }
              : g,
          ),
    [rows, groupBy, snapshot.accounts, dict],
  );

  const weekAvg = useMemo(() => {
    if (!isToday) {
      return null;
    }
    const avg = weekExpenseAverage(snapshot.transactions, dayKey);
    return avg > 0 ? avg : null;
  }, [isToday, snapshot.transactions, dayKey]);

  const insight = useMemo(
    () => dayInsightLine(summary, yesterday, isToday, weekAvg),
    [summary, yesterday, isToday, weekAvg],
  );

  const flowTotal = Math.max(1, summary.incomeRial + summary.expenseRial);
  const incomeShare = summary.incomeRial / flowTotal;
  const expenseShare = summary.expenseRial / flowTotal;

  const insightText = useMemo(() => {
    if (!insight) {
      return null;
    }
    if (insight.code === 'weekFlat') {
      return dict.daily.vsWeekFlat;
    }
    if (insight.code === 'weekMore') {
      return interpolate(dict.daily.vsWeekMore, {
        amount: formatTomanFromRial(insight.vars.amount as number),
      });
    }
    if (insight.code === 'weekLess') {
      return interpolate(dict.daily.vsWeekLess, {
        amount: formatTomanFromRial(insight.vars.amount as number),
      });
    }
    if (insight.code === 'yesterdayFlat') {
      return dict.daily.vsYesterdayFlat;
    }
    if (insight.code === 'yesterdayUp') {
      return `${interpolate(dict.daily.vsYesterday, {
        pct: toPersianDigits(String(insight.vars.pct)),
      })} · ${dict.daily.vsYesterdayUp}`;
    }
    return `${interpolate(dict.daily.vsYesterday, {
      pct: toPersianDigits(String(insight.vars.pct)),
    })} · ${dict.daily.vsYesterdayDown}`;
  }, [dict.daily, insight]);

  const insightColor =
    insight?.code === 'weekMore' || insight?.code === 'yesterdayUp'
      ? colors.expense
      : insight?.code === 'weekLess' || insight?.code === 'yesterdayDown'
        ? colors.income
        : colors.textMuted;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (snapshot.settings.smsProcessingEnabled) {
        await runSmsSync();
      } else {
        await new Promise<void>(r => {
          setTimeout(r, 350);
        });
      }
    } finally {
      setRefreshing(false);
    }
  }, [runSmsSync, snapshot.settings.smsProcessingEnabled]);

  const share = () => {
    void Share.share({
      message: [
        `📊 ${jalaliDayLabel(dayKey)}`,
        dayShareText(summary, jalaliDayLabel(dayKey), formatTomanFromRial, {
          income: dict.dashboard.income,
          expense: dict.dashboard.expense,
          net: dict.daily.net,
          transfer: dict.transactions.transfer,
          count: dict.daily.txCount,
        }),
      ].join('\n'),
      title: dict.daily.title,
    });
  };

  const goToday = () => {
    if (!isToday) {
      setDayKey(todayKey());
    }
  };

  const openAdd = (addMode: 'expense' | 'income') => {
    navigation.navigate('AddTransaction', { mode: addMode, dayKey });
  };

  const openCalendar = () => {
    navigation.navigate('Analytics', { section: 'calendar', calendarDayKey: dayKey });
  };

  const heroGradient =
    summary.netRial >= 0
      ? isLight
        ? ['rgba(255,255,255,0.62)', 'rgba(255,255,255,0.46)']
        : ['rgba(16,40,34,0.95)', 'rgba(12,22,24,0.88)']
      : isLight
        ? ['rgba(255,255,255,0.62)', 'rgba(255,255,255,0.46)']
        : ['rgba(42,22,24,0.95)', 'rgba(18,14,16,0.9)'];

  if (!hydrated) {
    return (
      <NightCanvas>
        <View style={[styles.skeletonWrap, { paddingTop: insets.top + 10 }]}>
          <Skeleton height={28} radius={8} />
          <Skeleton height={52} radius={16} />
          <Skeleton height={200} radius={24} />
          <Skeleton height={120} radius={18} />
        </View>
      </NightCanvas>
    );
  }

  return (
    <NightCanvas>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={{
          paddingTop: insets.top + 10,
          paddingBottom: 132,
        }}
        showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <View style={styles.topTitles}>
            <AppText style={styles.title}>{dict.daily.title}</AppText>
            <AppText style={styles.subtitle}>{dict.daily.subtitle}</AppText>
          </View>
          <View style={styles.brandTile}>
            <AppText style={styles.brandGlyph}>پ</AppText>
          </View>
        </View>

        <View style={styles.dateNav}>
          <PressScale
            onPress={() => setDayKey(shiftDayKey(dayKey, 1))}
            style={styles.navBtn}
            accessibilityLabel={dict.daily.tapToday}>
            <ChevronRight color={colors.textSecondary} size={20} />
          </PressScale>
          <Pressable onPress={goToday} style={styles.dateCenter}>
            <View style={styles.dateBadgeRow}>
              {isToday ? (
                <View style={styles.todayPill}>
                  <AppText style={styles.todayPillText}>{dict.daily.todayBadge}</AppText>
                </View>
              ) : null}
              <AppText style={styles.dateLabel}>{jalaliDayLabel(dayKey)}</AppText>
            </View>
            {!isToday ? (
              <AppText style={styles.tapToday}>{dict.daily.tapToday}</AppText>
            ) : (
              <AppText style={styles.weekdayHint}>{jalaliWeekdayShort(dayKey)}</AppText>
            )}
          </Pressable>
          <PressScale
            onPress={() => setDayKey(shiftDayKey(dayKey, -1))}
            style={styles.navBtn}
            accessibilityLabel={dict.daily.tapToday}>
            <ChevronLeft color={colors.textSecondary} size={20} />
          </PressScale>
        </View>

        <ScrollView
          ref={stripRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          // The strip is centred on the selected day; without this it opened at the
          // left edge, i.e. two weeks in the future, with today off-screen.
          onContentSizeChange={contentWidth => {
            const left =
              contentWidth - STRIP_PAD - (STRIP_RADIUS + 1) * STRIP_CHIP - STRIP_RADIUS * STRIP_GAP;
            stripRef.current?.scrollTo({ x: Math.max(0, left + STRIP_CHIP / 2 - width / 2), animated: false });
          }}
          contentContainerStyle={styles.strip}>
          {weekStrip.map(d => {
            const active = d.key === dayKey;
            const isStripToday = d.key === todayKey();
            const hasActivity = d.txCount > 0;
            return (
              <PressScale
                key={d.key}
                onPress={() => setDayKey(d.key)}
                style={[
                  styles.dayChip,
                  active && styles.dayChipOn,
                  isStripToday && !active && styles.dayChipToday,
                ]}>
                <AppText style={[styles.dayWeek, active && styles.dayWeekOn]}>
                  {jalaliWeekdayShort(d.key)}
                </AppText>
                <AppText style={[styles.dayNum, active && styles.dayNumOn]}>
                  {toPersianDigits(String(Number(d.key.split('-')[2])))}
                </AppText>
                <View
                  style={[
                    styles.activityDot,
                    hasActivity
                      ? {
                          backgroundColor:
                            active && isLight
                              ? colors.onPrimary
                              : d.netRial > 0
                              ? colors.income
                              : d.netRial < 0
                                ? colors.expense
                                : colors.primary,
                        }
                      : styles.activityDotEmpty,
                  ]}
                />
              </PressScale>
            );
          })}
        </ScrollView>

        {reviewCount > 0 ? (
          <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
            <AlertBanner
              tone="warn"
              message={interpolate(dict.daily.reviewDayChip, { n: reviewCount })}
              onPress={() => navigation.navigate('ReviewInbox')}
            />
          </View>
        ) : null}

        <LinearGradient colors={[...heroGradient]} style={styles.hero}>
          <View style={styles.heroTop}>
            <AppText style={styles.heroKicker}>{dict.daily.net}</AppText>
            <MoneyText align="left" minFontScale={0.55} style={styles.mtd}>
              {dict.daily.mtdNet}: {hidden ? '•••' : formatTomanFromRial(mtd, { sign: true })}
            </MoneyText>
          </View>

          <View style={styles.heroAmountRow}>
            {!hidden && summary.netRial !== 0 ? (
              <AppText
                style={{
                  fontSize: 28,
                  fontFamily: theme.typography.fontFamily.semibold,
                  color: summary.netRial >= 0 ? colors.income : colors.expense,
                }}>
                {summary.netRial > 0 ? '+' : '−'}
              </AppText>
            ) : null}
            <CountToman
              rial={Math.abs(summary.netRial)}
              hidden={hidden}
              style={{
                fontSize: 34,
                fontFamily: theme.typography.fontFamily.semibold,
                color: summary.netRial >= 0 ? colors.income : colors.expense,
              }}
            />
            <AppText style={styles.toman}>{dict.common.toman}</AppText>
          </View>

          {insightText ? (
            <AppText style={[styles.vs, { color: insightColor }]}>{insightText}</AppText>
          ) : null}

          {budgetHint && isToday ? (
            <AppText style={[styles.vs, { color: colors.textMuted }]}>
              {budgetHint.remainingMonthRial <= 0
                ? dict.daily.budgetOver
                : interpolate(dict.daily.budgetDaily, {
                    amount: hidden ? '•••' : formatTomanFromRial(budgetHint.dailyAllowanceRial),
                  })}
            </AppText>
          ) : null}

          {spendTrend.some(v => v > 0) ? (
            <View style={styles.trendBlock}>
              <AppText style={styles.trendLabel}>{dict.daily.spendTrend}</AppText>
              <Sparkline
                points={spendTrend}
                color={colors.expense}
                width={Math.min(width - 72, 320)}
                height={52}
              />
            </View>
          ) : null}

          <View style={styles.flowBlock}>
            <AppText style={styles.flowLabel}>{dict.daily.flowBalance}</AppText>
            <View style={styles.flowBar}>
              <View style={[styles.flowIncome, { flex: Math.max(0.04, incomeShare) }]} />
              <View style={[styles.flowExpense, { flex: Math.max(0.04, expenseShare) }]} />
            </View>
            <View style={styles.flowStats}>
              <View style={styles.flowStat}>
                <View style={styles.flowStatHead}>
                  <ArrowDownLeft color={colors.income} size={14} />
                  <AppText style={styles.flowStatLabel}>{dict.dashboard.income}</AppText>
                </View>
                <MoneyText
                  align="right"
                  minFontScale={0.55}
                  style={[styles.flowStatValue, { color: colors.income }]}>
                  {hidden ? '•••' : `+${formatTomanFromRial(summary.incomeRial)}`}
                </MoneyText>
                <AppText style={styles.flowCount}>
                  {toPersianDigits(String(summary.incomeCount))}
                </AppText>
              </View>
              <View style={styles.flowStat}>
                <View style={styles.flowStatHead}>
                  <ArrowUpRight color={colors.expense} size={14} />
                  <AppText style={styles.flowStatLabel}>{dict.dashboard.expense}</AppText>
                </View>
                <MoneyText
                  align="right"
                  minFontScale={0.55}
                  style={[styles.flowStatValue, { color: colors.expense }]}>
                  {hidden ? '•••' : `−${formatTomanFromRial(summary.expenseRial)}`}
                </MoneyText>
                <AppText style={styles.flowCount}>
                  {toPersianDigits(String(summary.expenseCount))}
                </AppText>
              </View>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.quickRow}>
          <PressScale onPress={() => openAdd('expense')} style={styles.quickExpense}>
            <Plus color={isLight ? colors.onPrimary : colors.expense} size={16} />
            <AppText style={[styles.quickText, { color: isLight ? colors.onPrimary : colors.expense }]}>
              {dict.daily.quickExpense}
            </AppText>
          </PressScale>
          <PressScale onPress={() => openAdd('income')} style={styles.quickIncome}>
            <Plus color={colors.income} size={16} />
            <AppText style={[styles.quickText, { color: colors.income }]}>
              {dict.daily.quickIncome}
            </AppText>
          </PressScale>
        </View>

        <View style={styles.pad}>
          <View style={styles.utilityRow}>
            <PressScale onPress={openCalendar} style={styles.utilityBtn}>
              <CalendarDays color={colors.primary} size={16} />
              <AppText variant="label" style={{ color: colors.primary }}>
                {dict.daily.viewCalendar}
              </AppText>
            </PressScale>
            <PressScale onPress={share} style={styles.utilityBtn} accessibilityLabel={dict.daily.share}>
              <Share2 color={colors.textSecondary} size={16} />
              <AppText variant="label" style={{ color: colors.textSecondary }}>
                {dict.daily.shareBtn}
              </AppText>
            </PressScale>
          </View>

          <SegmentedControl
            options={FILTERS}
            value={filter}
            onChange={setFilter}
            labelFor={f => dict.daily[f]}
          />

          {categoryFilter !== 'all' ? (
            <View style={[styles.chipRow, { marginTop: 10 }]}>
              <FilterChip
                label={`${dict.categories[categoryFilter]} ✕`}
                active
                onPress={() => setCategoryFilter('all')}
              />
            </View>
          ) : null}

          <View style={styles.optionsCard}>
            <View style={styles.optionBlock}>
              <AppText style={styles.optionLabel}>{dict.daily.sortBy}</AppText>
              <View style={styles.chipRow}>
                {SORTS.map(s => (
                  <FilterChip
                    key={s}
                    label={dict.daily[s]}
                    active={sort === s}
                    onPress={() => setSort(s)}
                  />
                ))}
              </View>
            </View>
            <View style={styles.optionBlock}>
              <AppText style={styles.optionLabel}>{dict.daily.groupBy}</AppText>
              <View style={styles.chipRow}>
                {GROUPS.map(g => (
                  <FilterChip
                    key={g}
                    label={dict.daily[`group_${g}`]}
                    active={groupBy === g}
                    onPress={() => setGroupBy(g)}
                  />
                ))}
              </View>
            </View>
          </View>

          {summary.categories.length > 0 && filter !== 'income' ? (
            <View style={styles.catCard}>
              <AppText style={styles.sectionTitle}>{dict.daily.byCategory}</AppText>
              {summary.categories.slice(0, 5).map(c => {
                const total = c.expenseRial + c.incomeRial;
                const max = Math.max(
                  1,
                  ...summary.categories.map(x => x.expenseRial + x.incomeRial),
                );
                const active = categoryFilter === c.categoryId;
                return (
                  <PressScale
                    key={c.categoryId}
                    onPress={() =>
                      setCategoryFilter(prev =>
                        prev === c.categoryId ? 'all' : c.categoryId,
                      )
                    }
                    style={styles.catRow}>
                    <View style={styles.catTop}>
                      <View style={styles.catMeta}>
                        <View
                          style={[
                            styles.catDot,
                            { backgroundColor: CATEGORY_COLOR[c.categoryId] },
                          ]}
                        />
                        <AppText
                          style={[
                            styles.catName,
                            active ? { color: colors.primary } : null,
                          ]}>
                          {dict.categories[c.categoryId]}
                        </AppText>
                      </View>
                      <MoneyText align="left" minFontScale={0.55} style={styles.catAmt}>
                        {hidden ? '•••' : formatTomanFromRial(total)}
                      </MoneyText>
                    </View>
                    <View style={styles.barBg}>
                      <View
                        style={[
                          styles.bar,
                          {
                            width: `${Math.round((total / max) * 100)}%`,
                            backgroundColor: CATEGORY_COLOR[c.categoryId],
                          },
                        ]}
                      />
                    </View>
                  </PressScale>
                );
              })}
            </View>
          ) : null}

          <View style={styles.listHead}>
            <AppText style={styles.sectionTitle}>
              {interpolate(dict.daily.txCount, { count: toPersianDigits(String(rows.length)) })}
            </AppText>
            <AppText style={styles.listHint}>{dict.daily.listTitle}</AppText>
          </View>

          {groupBy !== 'none' && groups.length > 0 ? (
            groups.map(g => (
              <Surface key={g.id} level="raised" style={styles.groupCard}>
                <View style={styles.groupHead}>
                  <AppText style={styles.groupLabel}>{g.label}</AppText>
                  <MoneyText align="left" minFontScale={0.55} style={styles.groupAmt}>
                    {hidden ? '•••' : formatTomanFromRial(g.expenseRial || g.incomeRial)}
                  </MoneyText>
                </View>
                {g.transactions.map((tx, index) => (
                  <TransactionRow
                    key={tx.id}
                    tx={tx}
                    grouped
                    isLast={index === g.transactions.length - 1}
                    onPress={() => navigation.navigate('TransactionDetails', { id: tx.id })}
                  />
                ))}
              </Surface>
            ))
          ) : rows.length === 0 ? (
            <View style={styles.emptyWrap}>
              <EmptyState
                title={rawDayTx.length === 0 ? dict.daily.empty : dict.daily.filterEmpty}
                subtitle={
                  rawDayTx.length === 0 ? dict.daily.emptyHint : dict.daily.filterEmptyHint
                }
              />
              {rawDayTx.length === 0 ? (
                <PrimaryButton label={dict.daily.addForDay} onPress={() => openAdd('expense')} />
              ) : (
                <PrimaryButton
                  label={dict.daily.clearCategory}
                  onPress={() => {
                    setFilter('all');
                    setCategoryFilter('all');
                  }}
                />
              )}
            </View>
          ) : (
            <View style={styles.listCard}>
              {rows.map((tx, i) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  grouped
                  isLast={i === rows.length - 1}
                  onPress={() => navigation.navigate('TransactionDetails', { id: tx.id })}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </NightCanvas>
  );
}
