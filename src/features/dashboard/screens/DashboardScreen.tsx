import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import {
  CalendarClock,
  Mic,
  ChevronLeft,
  MessageSquareText,
  Plus,
  Search,
  Settings2,
} from 'lucide-react-native';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { AppText } from '../../../components/ui/AppText';
import { PressScale } from '../../../components/ui/PressScale';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { Skeleton } from '../../../components/ui/Skeleton';
import { SwipeTxRow } from '../../../components/lists/SwipeTxRow';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { useFinanceStore } from '../../../store/finance/store';
import { navigateSmsHub } from '../../../app/navigation/smsNavigation';
import type { MainTabParamList, RootStackParamList } from '../../../app/navigation/types';
import { toJalaliMonthYear } from '../../../utils/dates/jalali';
import { formatTomanFromRial } from '../../../utils/currency/money';
import { toPersianDigits } from '../../../utils/numbers/digits';
import { t, interpolate } from '../../../i18n';
import { PortfolioSummary } from '../components/PortfolioSummary';
import { AssetCarousel } from '../components/AssetCarousel';
import { BudgetCard } from '../components/BudgetCard';
import { RecentTransaction } from '../components/RecentTransaction';
import { HomeFocus } from '../components/HomeFocus';
import { buildDashboardModel } from '../lib/dashboardModel';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function DashboardScreen({ navigation }: { navigation: Nav }) {
  const insets = useSafeAreaInsets();
  const { colors, mode } = useAppTheme();
  const snapshot = useFinanceStore(s => s.snapshot);
  const hydrated = useFinanceStore(s => s.hydrated);
  const toggle = useFinanceStore(s => s.toggleHideBalances);
  const runSmsSync = useFinanceStore(s => s.runIncrementalSmsSync);
  const syncStatus = useFinanceStore(s => s.smsSync.status);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const dict = t();
  const {
    accounts,
    transactions,
    settings,
    budgets,
    netWorthHistory,
    installmentPlans,
    cheques,
    debts,
  } = snapshot;
  const hidden = settings.hideBalances;
  const model = useMemo(
    () =>
      buildDashboardModel(
        {
          accounts,
          transactions,
          settings,
          budgets,
          netWorthHistory,
          installmentPlans,
          cheques,
          debts,
        },
        now,
      ),
    [
      accounts,
      transactions,
      settings,
      budgets,
      netWorthHistory,
      installmentPlans,
      cheques,
      debts,
      now,
    ],
  );
  // Calendar labels and month/day totals remain correct after midnight and on returning home.
  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
      const timer = setInterval(() => setNow(new Date()), 60_000);
      return () => clearInterval(timer);
    }, []),
  );
  const styles = useThemedStyles((c, th) => ({
    content: { gap: 10 },
    gutter: { marginHorizontal: 16 },
    header: {
      flexDirection: 'row-reverse',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 3,
      marginBottom: 1,
    },
    greeting: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
    greetingText: { flex: 1, alignItems: 'flex-end' },
    hello: {
      color: c.text,
      fontSize: 19,
      lineHeight: 30,
      fontFamily: th.typography.fontFamily.bold,
      textAlign: 'right',
    },
    period: { color: c.textSecondary, fontSize: 12, textAlign: 'right' },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 1 },
    iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    profile: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.glass,
      alignItems: 'center',
      justifyContent: 'center',
    },
    initial: { color: c.text, fontSize: 16, fontFamily: th.typography.fontFamily.bold },
    addButton: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minHeight: 48,
      borderRadius: 16,
      backgroundColor: c.primary,
    },
    addText: { color: c.onPrimary, fontSize: 16, fontFamily: th.typography.fontFamily.bold },
    shortcuts: { flexDirection: 'row-reverse', gap: 8, marginTop: 8 },
    shortcut: {
      flex: 1,
      alignItems: 'center',
      gap: 5,
      paddingVertical: 11,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.glassBorder,
      backgroundColor: c.glassStrong,
    },
    shortcutText: { fontSize: 13, color: c.text, fontFamily: th.typography.fontFamily.medium },
    recentCard: {
      paddingHorizontal: 14,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: c.glassBorder,
      backgroundColor: c.glassStrong,
    },
    sectionHeading: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 44,
    },
    sectionTitle: {
      flex: 1,
      color: c.text,
      fontSize: 16,
      fontFamily: th.typography.fontFamily.bold,
      textAlign: 'right',
    },
    all: { flexDirection: 'row-reverse', alignItems: 'center', gap: 3, minHeight: 44 },
    allText: { fontSize: 13, color: c.textSecondary },
    empty: { alignItems: 'center', paddingVertical: 15, gap: 9 },
    emptyTitle: { color: c.text, fontSize: 14, fontFamily: th.typography.fontFamily.semibold },
    emptyBody: { color: c.textMuted, fontSize: 11, lineHeight: 19, textAlign: 'center' },
    emptyButton: { alignSelf: 'stretch', marginTop: 4 },

    firstWin: { backgroundColor: c.glassStrong, padding: 14, borderRadius: 18, gap: 8 },
    firstWinTitle: { color: c.income, fontSize: 13, fontFamily: th.typography.fontFamily.semibold },
    firstWinBody: { color: c.textSecondary, fontSize: 12, lineHeight: 21 },
    skeleton: { padding: 20, gap: 10 },
  }));
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (settings.smsProcessingEnabled) {
        await runSmsSync();
      }
      setNow(new Date());
    } finally {
      setRefreshing(false);
    }
  }, [settings.smsProcessingEnabled, runSmsSync]);
  const onScan = () =>
    settings.smsProcessingEnabled ? void runSmsSync() : navigateSmsHub(navigation, false);
  const firstSms = useMemo(
    () => transactions.find(tx => tx.source === 'android_sms'),
    [transactions],
  );
  // One «add» entry (the add screen has expense / income / transfer tabs) and the
  // shortcuts people actually reach for, instead of three buttons for one screen.
  const shortcuts = [
    {
      key: 'voice',
      label: dict.home.actions.voice,
      a11y: dict.voiceEntry.a11yMic,
      Icon: Mic,
      go: () => navigation.navigate('VoiceEntry'),
    },
    {
      key: 'sms',
      label: dict.home.actions.sms,
      a11y: dict.dashboard.scanSms,
      Icon: MessageSquareText,
      go: onScan,
    },
    {
      key: 'dues',
      label: dict.home.actions.dues,
      a11y: dict.obligations.title,
      Icon: CalendarClock,
      go: () => navigation.navigate('Obligations'),
    },
  ];
  const name = (snapshot.profile.displayName ?? '').trim();
  return (
    <NightCanvas>
      {mode === 'light' ? <View pointerEvents="none" style={backdrop.veil} /> : null}
      {!hydrated ? (
        <View style={styles.skeleton}>
          <Skeleton height={190} radius={22} />
          <Skeleton height={139} radius={18} />
          <Skeleton height={210} radius={22} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 7, paddingBottom: Math.max(insets.bottom, 10) + 104 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing || syncStatus === 'scanning'}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }>
          <View style={[styles.header, styles.gutter]}>
            <PressScale
              onPress={() => navigation.navigate('AccountProfile')}
              style={styles.greeting}
              accessibilityRole="button"
              accessibilityLabel={dict.home.openProfile}>
              <View style={styles.profile}>
                <AppText style={styles.initial}>{name.charAt(0) || 'پ'}</AppText>
              </View>
              <View style={styles.greetingText}>
                <AppText style={styles.hello} numberOfLines={1}>
                  {name ? interpolate(dict.dashboard.hello, { name }) : dict.dashboard.helloAnon}
                </AppText>
                <AppText style={styles.period}>
                  {`${toJalaliMonthYear(now.toISOString())} · ${interpolate(dict.home.daysLeft, {
                    n: toPersianDigits(model.daysLeft),
                  })}`}
                </AppText>
              </View>
            </PressScale>
            <View style={styles.headerActions}>
              <PressScale
                onPress={() => navigation.navigate('Search')}
                style={styles.iconButton}
                accessibilityRole="button"
                accessibilityLabel={dict.search.a11y}>
                <Search size={20} strokeWidth={1.7} color={colors.text} />
              </PressScale>
              <PressScale
                onPress={() => navigation.navigate('Settings')}
                style={styles.iconButton}
                accessibilityRole="button"
                accessibilityLabel={dict.a11y.settings}>
                <Settings2 size={20} strokeWidth={1.7} color={colors.text} />
              </PressScale>
            </View>
          </View>
          <View style={styles.gutter}>
            <PortfolioSummary
              model={model}
              hidden={hidden}
              onHide={toggle}
              onOpen={() => navigation.navigate('Vault')}
            />
          </View>
          <AssetCarousel
            accounts={accounts}
            hidden={hidden}
            onOpen={id => navigation.navigate('AssetDetail', { id })}
            onAll={() => navigation.navigate('Vault')}
            onAdd={() => navigation.navigate('AddWealthAsset')}
          />
          <View style={styles.gutter}>
            <BudgetCard
              model={model}
              hidden={hidden}
              onPress={() => navigation.navigate('Budgets')}
            />
          </View>
          <View style={styles.gutter}>
            <PressScale
              onPress={() => navigation.navigate('AddTransaction', { mode: 'expense' })}
              style={styles.addButton}
              accessibilityRole="button"
              accessibilityLabel={dict.dashboard.addExpense}>
              <Plus size={21} strokeWidth={2} color={colors.onPrimary} />
              <AppText style={styles.addText}>{dict.home.addTransaction}</AppText>
            </PressScale>
            <View style={styles.shortcuts}>
              {shortcuts.map(item => (
                <PressScale
                  key={item.key}
                  onPress={item.go}
                  style={styles.shortcut}
                  accessibilityRole="button"
                  accessibilityLabel={item.a11y}>
                  <item.Icon size={21} strokeWidth={1.7} color={colors.text} />
                  <AppText style={styles.shortcutText}>{item.label}</AppText>
                </PressScale>
              ))}
            </View>
          </View>
          <HomeFocus hidden={hidden} />
          {settings.firstSmsWinReady && !settings.firstSmsWinDismissed && firstSms ? (
            <View style={[styles.firstWin, styles.gutter]}>
              <AppText style={styles.firstWinTitle}>{dict.dashboard.firstWinTitle}</AppText>
              <AppText style={styles.firstWinBody}>
                {interpolate(dict.dashboard.firstWinBody, {
                  amount: hidden ? '•••' : formatTomanFromRial(firstSms.amountRial),
                  bank: accounts.find(a => a.id === firstSms.accountId)?.name ?? dict.banks.generic,
                })}
              </AppText>
              <PrimaryButton
                label={dict.dashboard.firstWinOk}
                onPress={() => useFinanceStore.getState().dismissFirstSmsWin()}
              />
            </View>
          ) : null}
          <View style={styles.gutter}>
            <View style={styles.sectionHeading}>
              <AppText style={styles.sectionTitle}>{dict.home.recentTransactions}</AppText>
              <PressScale
                onPress={() => navigation.navigate('Transactions')}
                style={styles.all}
                accessibilityRole="button"
                accessibilityLabel={dict.transactions.title}>
                <AppText style={styles.allText}>{dict.dashboard.seeAll}</AppText>
                <ChevronLeft size={15} color={colors.textSecondary} />
              </PressScale>
            </View>
            {model.recent.length ? (
              <View style={styles.recentCard}>
                {model.recent.map((tx, index) => (
                  <SwipeTxRow key={tx.id} tx={tx}>
                    <RecentTransaction
                      tx={tx}
                      hidden={hidden}
                      now={now}
                      last={index === model.recent.length - 1}
                      onPress={() => navigation.navigate('TransactionDetails', { id: tx.id })}
                    />
                  </SwipeTxRow>
                ))}
              </View>
            ) : (
              <View style={styles.empty}>
                <AppText style={styles.emptyTitle}>{dict.dashboard.emptyTitle}</AppText>
                <AppText style={styles.emptyBody}>{dict.dashboard.emptyBody}</AppText>
                <View style={styles.emptyButton}>
                  <PrimaryButton
                    label={
                      settings.smsProcessingEnabled
                        ? dict.dashboard.scanInbox
                        : dict.dashboard.connectSms
                    }
                    onPress={onScan}
                  />
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </NightCanvas>
  );
}
const backdrop = StyleSheet.create({
  veil: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.40)' },
});
