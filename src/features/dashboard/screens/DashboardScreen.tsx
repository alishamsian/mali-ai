import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeftRight,
  CalendarClock,
  Eye,
  EyeOff,
  FileBarChart,
  MessageSquareText,
  PieChart,
  Plus,
  Settings2,
  Wallet,
} from 'lucide-react-native';
import { theme } from '../../../theme';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { AppText } from '../../../components/ui/AppText';
import { Section } from '../../../components/ui/Section';
import { Surface } from '../../../components/ui/Surface';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { PressScale } from '../../../components/ui/PressScale';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { TransactionRow } from '../../../components/lists/TransactionRow';
import { AlertBanner } from '../../../components/ui/AlertBanner';
import { CountToman } from '../../../components/ui/CountToman';
import { MoneyText } from '../../../components/ui/MoneyText';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { Skeleton, SkeletonRow } from '../../../components/ui/Skeleton';
import { t, interpolate } from '../../../i18n';
import { formatTomanFromRial, getDisplayCurrencyPreference } from '../../../utils/currency/money';
import { toJalaliWeekdayDate, toJalaliMonthYear } from '../../../utils/dates/jalali';
import { hapticSuccess } from '../../../utils/haptics';
import { selectMonthStats, selectReviewItems, useFinanceStore } from '../../../store/finance/store';
import { budgetAlerts } from '../../../engine/budget/alerts';
import { monthlyTotals, percentChange } from '../../../engine/insights/analytics';
import { dailyBrief } from '../../../engine/insights/dailyBrief';
import { summarizeDay, todayKey } from '../../../engine/insights/dailyLedger';
import { financialMonthTransactions } from '../../../engine/insights/monthPeriod';
import { buildProIntel } from '../../../engine/insights/pro';
import { currentMonthlyLimitRial, safeToSpendToday } from '../../../engine/insights/safeToSpend';
import { navigateSmsHub } from '../../../app/navigation/smsNavigation';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { MainTabParamList, RootStackParamList } from '../../../app/navigation/types';
import { DuesSummaryCard } from '../../obligations/components/DuesSummaryCard';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function DashboardScreen({ navigation }: { navigation: Nav }) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const snapshot = useFinanceStore(s => s.snapshot);
  const hydrated = useFinanceStore(s => s.hydrated);
  const toggle = useFinanceStore(s => s.toggleHideBalances);
  const dismissWin = useFinanceStore(s => s.dismissFirstSmsWin);
  const runSmsSync = useFinanceStore(s => s.runIncrementalSmsSync);
  const dict = t();
  const { transactions, settings, profile, unknownSms, budgetCategories } = snapshot;
  const hidden = settings.hideBalances;
  // Memos take only the slices they read, so unrelated writes (sync queue, etc.) skip them.
  const stats = useMemo(
    () => selectMonthStats({ transactions, settings }),
    [transactions, settings],
  );
  const prevStats = useMemo(
    () => monthlyTotals(financialMonthTransactions({ transactions, settings }, -1)),
    [transactions, settings],
  );
  const total = useMemo(
    () => snapshot.accounts.reduce((s, a) => s + a.balanceRial, 0),
    [snapshot.accounts],
  );
  const intel = useMemo(
    () => buildProIntel(transactions, total, new Date(), { transactions, settings, profile }),
    [transactions, settings, profile, total],
  );
  const brief = useMemo(
    () => dailyBrief(snapshot.transactions, intel, snapshot.recurring),
    [snapshot.transactions, intel, snapshot.recurring],
  );
  const todayFlow = useMemo(
    () => summarizeDay(snapshot.transactions, todayKey()),
    [snapshot.transactions],
  );
  const reviewCount = useMemo(() => {
    const items = selectReviewItems({ transactions, unknownSms });
    return items.transactions.length + items.unknown.length;
  }, [transactions, unknownSms]);
  // settings is a dependency now: toggling budget alerts used to leave stale alerts up.
  const alerts = useMemo(
    () => budgetAlerts({ transactions, budgetCategories, settings }),
    [transactions, budgetCategories, settings],
  );
  const smsOn = snapshot.settings.smsProcessingEnabled;
  const recent = useMemo(
    () =>
      [...snapshot.transactions]
        .sort((a, b) => {
          const cmp = b.transactionDate.localeCompare(a.transactionDate);
          if (cmp !== 0) {
            return cmp;
          }
          return String(b.sourceSmsId ?? '').localeCompare(String(a.sourceSmsId ?? ''), undefined, {
            numeric: true,
          });
        })
        .slice(0, 5),
    [snapshot.transactions],
  );
  const firstSms = useMemo(
    () => snapshot.transactions.find(tx => tx.source === 'android_sms'),
    [snapshot.transactions],
  );
  const showFirstWin = Boolean(
    snapshot.settings.firstSmsWinReady && !snapshot.settings.firstSmsWinDismissed && firstSms,
  );
  const firstAccount = snapshot.accounts.find(a => a.id === firstSms?.accountId);
  const todayLabel = useMemo(() => toJalaliWeekdayDate(), []);
  const monthLabel = useMemo(() => toJalaliMonthYear(new Date().toISOString()), []);
  const moneyUnit = getDisplayCurrencyPreference() === 'IRR' ? dict.common.rial : dict.common.toman;
  const monthNetTone =
    stats.savingsRial > 0
      ? colors.income
      : stats.savingsRial < 0
      ? colors.expense
      : colors.textSecondary;
  const expenseDeltaPct = percentChange(stats.expenseRial, prevStats.expenseRial);
  const expenseDeltaLabel = useMemo(() => {
    if (hidden) {
      return null;
    }
    if (Math.abs(expenseDeltaPct) < 1) {
      return dict.dashboard.expenseFlat;
    }
    if (expenseDeltaPct > 0) {
      return interpolate(dict.dashboard.expenseUp, { pct: Math.round(expenseDeltaPct) });
    }
    return interpolate(dict.dashboard.expenseDown, { pct: Math.round(Math.abs(expenseDeltaPct)) });
  }, [dict.dashboard, expenseDeltaPct, hidden]);
  const briefText = useMemo(() => {
    if (!brief) {
      return null;
    }
    const msg = dict.dashboard.brief[brief.code];
    if (brief.code === 'spent') {
      return interpolate(msg, {
        amount: formatTomanFromRial(brief.vars.amountRial as number),
      });
    }
    if (brief.code === 'due') {
      return interpolate(msg, {
        n: brief.vars.n as number,
        name: brief.vars.name as string,
      });
    }
    return msg;
  }, [brief, dict.dashboard.brief]);
  const todaySummaryText = useMemo(
    () =>
      interpolate(dict.dashboard.todaySummary, {
        expense: hidden ? '•••' : formatTomanFromRial(todayFlow.expenseRial),
        income: hidden ? '•••' : formatTomanFromRial(todayFlow.incomeRial),
      }),
    [dict.dashboard.todaySummary, hidden, todayFlow.expenseRial, todayFlow.incomeRial],
  );
  const safe = useMemo(
    () =>
      safeToSpendToday({
        monthlyLimitRial: currentMonthlyLimitRial(snapshot),
        monthIncomeRial: intel.monthIncomeRial,
        monthExpenseRial: intel.monthExpenseRial,
        todayExpenseRial: todayFlow.expenseRial,
        dayOfMonth: intel.dayOfMonth,
        daysInMonth: intel.daysInMonth,
      }),
    [snapshot, intel, todayFlow.expenseRial],
  );
  const safeTone =
    safe.ratio > 1 ? colors.highlight : safe.ratio >= 0.8 ? colors.highlight : colors.glassStrong;
  const greeting = snapshot.profile.displayName
    ? interpolate(dict.dashboard.hello, { name: snapshot.profile.displayName })
    : dict.dashboard.helloAnon;
  const topAlert = alerts[0];
  const guestPreview = snapshot.settings.guestPreviewActive;
  const smsSyncStatus = useFinanceStore(s => s.smsSync.status);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (smsOn) {
        await runSmsSync();
      } else {
        await new Promise<void>(resolve => {
          setTimeout(resolve, 350);
        });
      }
    } finally {
      setRefreshing(false);
    }
  }, [runSmsSync, smsOn]);

  const monthPulseLabel = `${dict.dashboard.monthPulse} · ${monthLabel}`;

  const onSmsCta = () => {
    if (smsOn) {
      void runSmsSync();
      return;
    }
    navigateSmsHub(navigation, false);
  };

  if (!hydrated) {
    return (
      <NightCanvas>
        <View
          style={{
            paddingTop: insets.top + 6,
            paddingBottom: 120,
            paddingHorizontal: 16,
            gap: 12,
          }}>
          <Skeleton height={260} radius={32} />
          <Skeleton height={88} radius={28} />
          <Surface level="raised" style={{ paddingHorizontal: 8 }}>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </Surface>
        </View>
      </NightCanvas>
    );
  }

  const quick = [
    {
      key: 'obligations',
      label: dict.obligations.title,
      Icon: CalendarClock,
      go: () => navigation.navigate('Obligations'),
    },
    {
      key: 'recap',
      label: dict.dashboard.quickRecap,
      Icon: FileBarChart,
      go: () => navigation.navigate('Analytics', { section: 'recap' }),
    },
    {
      key: 'calendar',
      label: dict.dashboard.quickCalendar,
      Icon: PieChart,
      go: () => navigation.navigate('Analytics', { section: 'calendar' }),
    },
    {
      key: 'budget',
      label: dict.dashboard.quickBudget,
      Icon: Wallet,
      go: () => navigation.navigate('Budgets'),
    },
  ];

  return (
    <NightCanvas>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing || smsSyncStatus === 'scanning'}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={{
          paddingTop: insets.top + 6,
          paddingBottom: 130,
          paddingHorizontal: 16,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}>
        <GlassPanel radius={34} style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.greetBlock}>
              <AppText style={[styles.greet, { color: colors.text }]}>{greeting}</AppText>
              <AppText style={[styles.greetSub, { color: colors.textMuted }]}>{todayLabel}</AppText>
            </View>
            <View style={styles.heroActions}>
              <View style={[styles.brandTile, { backgroundColor: colors.primary }]}>
                <AppText style={[styles.brandGlyph, { color: colors.onPrimary }]}>پ</AppText>
              </View>
              <PressScale
                onPress={() => navigation.navigate('Settings')}
                accessibilityLabel={dict.a11y.settings}>
                <GlassPanel strong radius={16} style={styles.iconBtn}>
                  <Settings2 color={colors.text} size={19} strokeWidth={1.8} />
                </GlassPanel>
              </PressScale>
              <PressScale onPress={toggle} accessibilityLabel={dict.a11y.hideBalance}>
                <GlassPanel strong radius={16} style={styles.iconBtn}>
                  {hidden ? (
                    <EyeOff color={colors.text} size={19} strokeWidth={1.8} />
                  ) : (
                    <Eye color={colors.text} size={19} strokeWidth={1.8} />
                  )}
                </GlassPanel>
              </PressScale>
            </View>
          </View>

          {expenseDeltaLabel ? (
            <View style={[styles.deltaChip, { backgroundColor: colors.highlight }]}>
              <AppText style={[styles.deltaText, { color: colors.onHighlight }]}>
                {expenseDeltaLabel}
              </AppText>
            </View>
          ) : null}
          <PressScale
            onPress={() => navigation.navigate('Vault')}
            accessibilityLabel={`${dict.dashboard.balanceCash}، ${dict.nav.vault}`}
            style={styles.balanceBlock}>
            <CountToman
              rial={total}
              hidden={hidden}
              style={[styles.balanceNum, { color: colors.text }]}
            />
            <AppText style={[styles.unit, { color: colors.textSecondary }]}>
              {dict.dashboard.balanceCash} · {moneyUnit}
            </AppText>
          </PressScale>

          <PressScale onPress={() => navigation.navigate('Budgets')} style={styles.safePillWrap}>
            <GlassPanel
              strong
              radius={999}
              style={[styles.safePill, { backgroundColor: safeTone }]}>
              {safe.basis === 'none' ? (
                <AppText style={[styles.safeText, { color: colors.textSecondary }]}>
                  {dict.dashboard.safeNoBudget}
                </AppText>
              ) : (
                <AppText style={[styles.safeText, { color: colors.textSecondary }]}>
                  {safe.leftRial < 0 ? dict.dashboard.overToday : dict.dashboard.safeToday}{' '}
                  <AppText style={[styles.safeAmount, { color: colors.text }]}>
                    {hidden ? '•••' : formatTomanFromRial(Math.abs(safe.leftRial))}
                  </AppText>
                </AppText>
              )}
            </GlassPanel>
          </PressScale>
        </GlassPanel>

        <View style={styles.actions}>
          <PressScale
            style={styles.actionWide}
            onPress={() => navigation.navigate('AddTransaction', { mode: 'expense' })}
            accessibilityLabel={dict.dashboard.addExpense}>
            <GlassPanel radius={28} style={styles.actionInner}>
              <Plus color={colors.text} size={20} strokeWidth={1.9} />
              <AppText style={[styles.actionLabel, { color: colors.text }]}>
                {dict.dashboard.addExpense}
              </AppText>
            </GlassPanel>
          </PressScale>
          <PressScale
            style={styles.actionSquare}
            onPress={() => navigation.navigate('AddTransaction', { mode: 'transfer' })}
            accessibilityLabel={dict.dashboard.transfer}>
            <GlassPanel strong radius={28} style={styles.actionInner}>
              <ArrowLeftRight color={colors.text} size={24} strokeWidth={1.8} />
            </GlassPanel>
          </PressScale>
          <PressScale
            style={styles.actionWide}
            onPress={onSmsCta}
            accessibilityLabel={dict.dashboard.scanSms}>
            <GlassPanel radius={28} style={styles.actionInner}>
              <MessageSquareText color={colors.text} size={20} strokeWidth={1.9} />
              <AppText style={[styles.actionLabel, { color: colors.text }]}>
                {dict.dashboard.scanSms}
              </AppText>
            </GlassPanel>
          </PressScale>
        </View>

        {reviewCount > 0 ? (
          <GlassPanel radius={24} style={styles.reviewRow}>
            <View style={styles.reviewText}>
              <AppText style={[styles.rowTitle, { color: colors.text }]}>
                {interpolate(dict.dashboard.reviewTitle, { n: reviewCount })}
              </AppText>
              <AppText style={[styles.rowSub, { color: colors.textMuted }]}>
                {dict.dashboard.reviewSub}
              </AppText>
            </View>
            <PressScale
              onPress={() => navigation.navigate('ReviewInbox')}
              style={[styles.inkBtn, { backgroundColor: colors.primary }]}>
              <AppText style={[styles.inkBtnText, { color: colors.onPrimary }]}>
                {dict.dashboard.reviewCta}
              </AppText>
            </PressScale>
          </GlassPanel>
        ) : null}

        <DuesSummaryCard hidden={hidden} />

        <GlassPanel radius={30} style={styles.monthPanel}>
          <View style={styles.pillLabelWrap} pointerEvents="none">
            <GlassPanel strong radius={999} style={styles.pillLabel}>
              <AppText style={[styles.pillLabelText, { color: colors.text }]}>
                {monthPulseLabel}
              </AppText>
            </GlassPanel>
          </View>
          <View style={styles.monthRow}>
            <PressScale
              style={styles.monthStats}
              onPress={() => navigation.navigate('Analytics', { section: 'recap' })}
              accessibilityLabel={dict.dashboard.monthReport}>
              <GlassPanel strong radius={20} style={styles.monthStatsInner}>
                <View style={styles.statLine}>
                  <AppText style={[styles.statLabel, { color: colors.textMuted }]}>
                    {dict.dashboard.income}
                  </AppText>
                  <MoneyText
                    align="right"
                    minFontScale={0.6}
                    style={[styles.statValue, { color: colors.income }]}>
                    {hidden ? '•••' : `+${formatTomanFromRial(stats.incomeRial)}`}
                  </MoneyText>
                </View>
                <View style={styles.statLine}>
                  <AppText style={[styles.statLabel, { color: colors.textMuted }]}>
                    {dict.dashboard.expense}
                  </AppText>
                  <MoneyText
                    align="right"
                    minFontScale={0.6}
                    style={[styles.statValue, { color: colors.text }]}>
                    {hidden ? '•••' : `−${formatTomanFromRial(stats.expenseRial)}`}
                  </MoneyText>
                </View>
                <View style={styles.statLine}>
                  <AppText style={[styles.statLabel, { color: colors.textMuted }]}>
                    {dict.dashboard.savings}
                  </AppText>
                  <MoneyText
                    align="right"
                    minFontScale={0.6}
                    style={[styles.statValue, { color: monthNetTone }]}>
                    {hidden ? '•••' : formatTomanFromRial(stats.savingsRial, { sign: true })}
                  </MoneyText>
                </View>
              </GlassPanel>
            </PressScale>
            <View style={styles.quickGrid}>
              {quick.map(q => (
                <PressScale
                  key={q.key}
                  onPress={q.go}
                  accessibilityLabel={q.label}
                  style={styles.quickCell}>
                  <GlassPanel strong radius={16} style={styles.quickTile}>
                    <q.Icon color={colors.text} size={19} strokeWidth={1.8} />
                    <AppText
                      style={[styles.quickLabel, { color: colors.textSecondary }]}
                      numberOfLines={1}>
                      {q.label}
                    </AppText>
                  </GlassPanel>
                </PressScale>
              ))}
            </View>
          </View>
          {briefText ? (
            <AppText style={[styles.brief, { color: colors.textSecondary }]}>
              {todaySummaryText} · {briefText}
            </AppText>
          ) : null}
        </GlassPanel>

        {snapshot.transactions.length === 0 && !guestPreview ? (
          <GlassPanel radius={28} style={{ padding: 16 }}>
            <EmptyState title={dict.dashboard.emptyTitle} subtitle={dict.dashboard.emptyBody} />
            <PrimaryButton
              label={smsOn ? dict.dashboard.scanInbox : dict.dashboard.connectSms}
              onPress={onSmsCta}
            />
          </GlassPanel>
        ) : null}

        {guestPreview ? (
          <AlertBanner
            tone="info"
            message={dict.dashboard.guestPreviewHint}
            onPress={() => navigateSmsHub(navigation, false)}
          />
        ) : null}

        {showFirstWin && firstSms ? (
          <GlassPanel radius={28} style={{ padding: 16, gap: 10 }}>
            <AppText variant="kicker" style={{ textAlign: 'right', color: colors.income }}>
              {dict.dashboard.firstWinTitle}
            </AppText>
            <AppText style={{ textAlign: 'right', lineHeight: 24 }}>
              {interpolate(dict.dashboard.firstWinBody, {
                amount: formatTomanFromRial(firstSms.amountRial),
                bank: firstAccount?.name ?? dict.banks.generic,
              })}
            </AppText>
            <PrimaryButton
              label={dict.dashboard.firstWinOk}
              onPress={() => {
                hapticSuccess();
                dismissWin();
              }}
            />
          </GlassPanel>
        ) : null}

        {topAlert ? (
          <AlertBanner
            tone="warn"
            message={interpolate(topAlert.ratio >= 1 ? dict.budgets.over : dict.budgets.warn, {
              name: dict.categories[topAlert.categoryId],
              pct: Math.round(topAlert.ratio * 100),
            })}
            onPress={() => navigation.navigate('Budgets')}
          />
        ) : null}

        <Section
          title={dict.dashboard.recent}
          actionLabel={dict.dashboard.seeAll}
          onAction={() => navigation.navigate('Transactions')}>
          <GlassPanel radius={26} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
            {recent.length === 0 ? (
              <AppText variant="caption" style={styles.emptyRecent}>
                {dict.transactions.empty}
              </AppText>
            ) : (
              recent.map((tx, index) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  compact
                  grouped
                  isLast={index === recent.length - 1}
                  onPress={() => navigation.navigate('TransactionDetails', { id: tx.id })}
                />
              ))
            )}
          </GlassPanel>
        </Section>
      </ScrollView>
    </NightCanvas>
  );
}

const rtlText = { textAlign: 'right' as const, writingDirection: 'rtl' as const };

const styles = StyleSheet.create({
  hero: {
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 36,
    alignItems: 'center',
    marginBottom: 14,
  },
  heroTop: {
    alignSelf: 'stretch',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greetBlock: { flex: 1, alignItems: 'flex-end', gap: 2 },
  greet: { ...rtlText, fontSize: 16, fontFamily: theme.typography.fontFamily.bold },
  greetSub: { ...rtlText, fontSize: 13 },
  heroActions: { flexDirection: 'row-reverse', gap: 8, alignItems: 'center' },
  brandTile: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandGlyph: { fontSize: 28, lineHeight: 40, fontFamily: theme.typography.fontFamily.bold },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  deltaChip: { marginTop: 18, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  deltaText: { fontSize: 12, fontFamily: theme.typography.fontFamily.bold, textAlign: 'center' },
  balanceBlock: { alignItems: 'center', marginTop: 6 },
  balanceNum: { fontSize: 46, letterSpacing: -1, textAlign: 'center', writingDirection: 'ltr' },
  unit: { fontSize: 13, textAlign: 'center', writingDirection: 'rtl', marginTop: 2 },
  safePillWrap: { position: 'absolute', bottom: -18, alignSelf: 'center' },
  safePill: { paddingHorizontal: 16, paddingVertical: 8 },
  safeText: { fontSize: 13, textAlign: 'center', writingDirection: 'rtl' },
  safeAmount: { fontSize: 13, fontFamily: theme.typography.fontFamily.bold },
  actions: { flexDirection: 'row-reverse', gap: 10, marginTop: 6 },
  actionWide: { flex: 1 },
  actionSquare: { width: 84 },
  actionInner: { height: 88, alignItems: 'center', justifyContent: 'center', gap: 6 },
  actionLabel: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.semibold,
    textAlign: 'center',
  },
  reviewRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, padding: 12 },
  reviewText: { flex: 1, alignItems: 'flex-end', gap: 2 },
  rowTitle: { ...rtlText, fontSize: 15, fontFamily: theme.typography.fontFamily.semibold },
  rowSub: { ...rtlText, fontSize: 12 },
  inkBtn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inkBtnText: { fontSize: 13, fontFamily: theme.typography.fontFamily.bold },
  monthPanel: { paddingTop: 26, paddingHorizontal: 10, paddingBottom: 12, gap: 10, marginTop: 10 },
  pillLabelWrap: { position: 'absolute', top: -14, left: 0, right: 0, alignItems: 'center' },
  pillLabel: { paddingHorizontal: 14, paddingVertical: 4 },
  pillLabelText: { fontSize: 12, fontFamily: theme.typography.fontFamily.semibold },
  monthRow: { flexDirection: 'row-reverse', gap: 8 },
  monthStats: { flex: 1 },
  monthStatsInner: { flex: 1, padding: 12, gap: 8, justifyContent: 'center' },
  statLine: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  statLabel: { ...rtlText, fontSize: 12 },
  statValue: { flexShrink: 1, fontSize: 14, fontFamily: theme.typography.fontFamily.semibold },
  quickGrid: { width: 132, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  quickCell: { width: 62 },
  quickTile: { height: 62, alignItems: 'center', justifyContent: 'center', gap: 3 },
  quickLabel: { fontSize: 10, textAlign: 'center' },
  brief: { ...rtlText, fontSize: 12, lineHeight: 20, paddingHorizontal: 6 },
  emptyRecent: { textAlign: 'center', padding: 20 },
});
