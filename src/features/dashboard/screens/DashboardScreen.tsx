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
import { t, interpolate } from '../../../i18n';
import { PortfolioSummary } from '../components/PortfolioSummary';
import { AssetCarousel } from '../components/AssetCarousel';
import { MonthPulse } from '../components/MonthPulse';
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
    brand: { alignItems: 'flex-end' },
    wordmark: {
      color: c.text,
      fontSize: 27,
      lineHeight: 36,
      fontFamily: th.typography.fontFamily.bold,
    },
    page: { color: c.textMuted, fontSize: 10 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 1 },
    iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    profile: {
      width: 33,
      height: 33,
      borderRadius: 17,
      backgroundColor: c.glass,
      alignItems: 'center',
      justifyContent: 'center',
    },
    initial: { color: c.text, fontSize: 16, fontFamily: th.typography.fontFamily.bold },
    actions: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 3,
    },
    action: { minWidth: 64, alignItems: 'center', gap: 5 },
    circle: {
      width: 51,
      height: 51,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: c.glassBorder,
      backgroundColor: c.glass,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mainAction: { backgroundColor: c.primary, borderColor: c.primary },
    actionText: { fontSize: 12, color: c.text, fontFamily: th.typography.fontFamily.medium },
    sectionHeading: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 44,
    },
    sectionTitle: { color: c.text, fontSize: 16, fontFamily: th.typography.fontFamily.bold },
    all: { flexDirection: 'row-reverse', alignItems: 'center', gap: 3, minHeight: 44 },
    allText: { fontSize: 12, color: c.textSecondary },
    empty: { alignItems: 'center', paddingVertical: 15, gap: 9 },
    emptyTitle: { color: c.text, fontSize: 14, fontFamily: th.typography.fontFamily.semibold },
    emptyBody: { color: c.textMuted, fontSize: 11, lineHeight: 19, textAlign: 'center' },
    emptyButton: { alignSelf: 'stretch', marginTop: 4 },
    recentUnit: { color: c.textMuted, fontSize: 9, textAlign: 'left', marginBottom: 2 },
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
  const actions = [
    {
      key: 'add',
      label: dict.home.actions.add,
      a11y: dict.dashboard.addExpense,
      Icon: Plus,
      go: () => navigation.navigate('AddTransaction', { mode: 'expense' }),
    },
    {
      key: 'voice',
      label: dict.home.actions.voice,
      a11y: dict.voiceEntry.a11yMic,
      Icon: Mic,
      go: () => navigation.navigate('VoiceEntry'),
    },
    {
      key: 'dues',
      label: dict.home.actions.dues,
      a11y: dict.obligations.title,
      Icon: CalendarClock,
      go: () => navigation.navigate('Obligations'),
    },
    {
      key: 'sms',
      label: dict.home.actions.sms,
      a11y: dict.dashboard.scanSms,
      Icon: MessageSquareText,
      go: onScan,
    },
  ];
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
            <View style={styles.brand}>
              <AppText style={styles.wordmark}>{dict.appName}</AppText>
              <AppText style={styles.page}>{dict.nav.home}</AppText>
            </View>
            <View style={styles.headerActions}>
              <PressScale
                onPress={() => navigation.navigate('AccountProfile')}
                style={styles.iconButton}
                accessibilityRole="button"
                accessibilityLabel={dict.home.openProfile}>
                <View style={styles.profile}>
                  <AppText style={styles.initial}>
                    {(snapshot.profile.displayName ?? '').trim().charAt(0) || 'پ'}
                  </AppText>
                </View>
              </PressScale>
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
          <View style={[styles.actions, styles.gutter]}>
            {actions.map((action, index) => (
              <PressScale
                key={action.key}
                onPress={action.go}
                style={styles.action}
                accessibilityRole="button"
                accessibilityLabel={action.a11y}>
                <View style={[styles.circle, index === 0 && styles.mainAction]}>
                  <action.Icon
                    size={22}
                    strokeWidth={1.7}
                    color={index === 0 ? colors.onPrimary : colors.text}
                  />
                </View>
                <AppText style={styles.actionText}>{action.label}</AppText>
              </PressScale>
            ))}
          </View>
          <HomeFocus hidden={hidden} />
          <View style={styles.gutter}>
            <MonthPulse
              model={model}
              hidden={hidden}
              label={toJalaliMonthYear(now.toISOString())}
              onReport={() => navigation.navigate('Analytics', { section: 'recap' })}
              onBudget={() => navigation.navigate('Budgets')}
            />
          </View>
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
            <AppText style={styles.recentUnit}>
              {settings.displayCurrency === 'IRR' ? dict.common.rial : dict.common.toman}
            </AppText>
            {model.recent.length ? (
              model.recent.map((tx, index) => (
                <SwipeTxRow key={tx.id} tx={tx}>
                  <RecentTransaction
                    tx={tx}
                    hidden={hidden}
                    now={now}
                    last={index === model.recent.length - 1}
                    onPress={() => navigation.navigate('TransactionDetails', { id: tx.id })}
                  />
                </SwipeTxRow>
              ))
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
