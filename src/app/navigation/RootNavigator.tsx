import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Linking, View } from 'react-native';
import {
  DarkTheme,
  NavigationContainer,
  type NavigationState,
  type PartialState,
} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { TabNavigator } from './TabNavigator';
import { OnboardingScreen } from '../../features/onboarding/screens/OnboardingScreen';
import { SmsOnboardingScreen } from '../../features/sms/screens/SmsOnboardingScreen';
import { SmsSenderPickerScreen } from '../../features/sms/screens/SmsSenderPickerScreen';
import { SmsSenderConfirmScreen } from '../../features/sms/screens/SmsSenderConfirmScreen';
import { BankSendersManageScreen } from '../../features/sms/screens/BankSendersManageScreen';
import { SmsTestGateScreen } from './SmsTestGateScreen';
import { SmsParserLabScreen } from '../../features/sms/screens/SmsParserLabScreen';
import { ReviewInboxScreen } from '../../features/sms/screens/ReviewInboxScreen';
import { TransactionsScreen } from '../../features/transactions/screens/TransactionsScreen';
import { TransactionDetailsScreen } from '../../features/transactions/screens/TransactionDetailsScreen';
import { AddTransactionScreen } from '../../features/transactions/screens/AddTransactionScreen';
import { SearchScreen } from '../../features/transactions/screens/SearchScreen';
import { VoiceEntryScreen } from '../../features/transactions/screens/VoiceEntryScreen';
import { BudgetsScreen } from '../../features/budgets/screens/BudgetsScreen';
import { ToolsScreen } from '../../features/more/screens/ToolsScreen';
import { SmsSetupScreen } from '../../features/sms/screens/SmsSetupScreen';
import { withCanvas } from '../../components/ui/withCanvas';
import { ObligationsScreen } from '../../features/obligations/screens/ObligationsScreen';
import { AddObligationScreen } from '../../features/obligations/screens/AddObligationScreen';
import {
  AnalyticsRedirect,
  AssistantRedirect,
  CalendarRedirect,
  GoalsRedirect,
  InsightsRedirect,
  RecapRedirect,
  RecurringRedirect,
} from './redirectScreens';
import { DailyLedgerScreen } from '../../features/ledger/screens/DailyLedgerScreen';
import { CinematicBalanceScreen } from '../../features/moments/screens/CinematicBalanceScreen';
import { ProfileScreen } from '../../features/settings/screens/ProfileScreen';
import { PrivacyScreen } from '../../features/settings/screens/PrivacyScreen';
import { AuthScreen } from '../../features/auth/screens/AuthScreen';
import { NotificationsScreen } from '../../features/settings/screens/NotificationsScreen';
import { AssetDetailScreen } from '../../features/wealth/screens/AssetDetailScreen';
import { AddWealthAssetScreen } from '../../features/wealth/screens/AddWealthAssetScreen';
import { SettingsHomeScreen } from '../../features/settings/screens/SettingsHomeScreen';
import {
  SettingsAboutScreen,
  SettingsAccountsScreen,
  SettingsAppearanceScreen,
  SettingsAssetsScreen,
  SettingsBackupScreen,
  SettingsCloudScreen,
  SettingsBanksSmsScreen,
  SettingsBudgetsScreen,
  SettingsDataScreen,
  SettingsDeveloperScreen,
  SettingsFinancialScreen,
  SettingsInsightsScreen,
  SettingsLanguageScreen,
  SettingsNotificationsPrefsScreen,
  SettingsPricesScreen,
  SettingsReportsScreen,
  SettingsSecurityScreen,
  SettingsSupportScreen,
} from '../../features/settings/screens/SettingsCategoryScreens';
import { useFinanceStore } from '../../store/finance/store';
import { subscribeIncomingSms } from '../../features/sms/native/SmsModule';
import { useAppMotion } from '../../hooks/useAppMotion';
import { AppText } from '../../components/ui/AppText';
import type { RootStackParamList } from './types';
import { getStorageDriver } from '../../database/drivers/storageBootstrap';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { screenErrorLayout } from '../../components/errors/ErrorBoundary';
import { setCloudAutoRefresh } from '../../services/supabase/client';
import { pushWidgetState, watchWidget } from '../../services/widget/widgetState';
import { checkForUpdate } from '../../services/update/checkForUpdate';
import { runSmartAlerts, watchSmartAlerts } from '../../services/notifications/smartAlerts';
import { useCloudAuthLinks } from './useCloudAuthLinks';

const SmsOnboardingCanvas = withCanvas(SmsOnboardingScreen);
const SmsSenderConfirmCanvas = withCanvas(SmsSenderConfirmScreen);
const BankSendersManageCanvas = withCanvas(BankSendersManageScreen);
const AuthCanvas = withCanvas(AuthScreen);
const PrivacyCanvas = withCanvas(PrivacyScreen);

const Stack = createNativeStackNavigator<RootStackParamList>();
const NAV_STATE_KEY = 'mali.nav.state.v1';

type MainProps = NativeStackScreenProps<RootStackParamList, 'Main'>;

/** کامپوننت پایدار — تابع ناشناس داخل Screen با هر رندر تم ریمونت می‌کرد */
function MainScreen({ navigation }: MainProps) {
  // Home-screen widget shortcuts: poolet://add and poolet://voice.
  useEffect(() => {
    const open = (url: string | null) => {
      if (url?.startsWith('poolet://add')) {
        navigation.navigate('AddTransaction', { mode: 'expense' });
      } else if (url?.startsWith('poolet://voice')) {
        navigation.navigate('VoiceEntry');
      }
    };
    void Linking.getInitialURL().then(open);
    const sub = Linking.addEventListener('url', event => open(event.url));
    return () => sub.remove();
  }, [navigation]);
  return (
    <TabNavigator
      onAdd={() => navigation.navigate('AddTransaction', { mode: 'expense' })}
      onVoice={() => navigation.navigate('VoiceEntry')}
    />
  );
}

/**
 * تم NavigationContainer را عمداً ثابت نگه می‌داریم.
 * عوض کردن theme پراپ روی native-stack گاهی استک را به initialRoute برمی‌گرداند
 * و کاربر را از صفحهٔ ظاهر «بیرون» می‌اندازد. رنگ واقعی صفحات از NightCanvas/useAppTheme است.
 */
const STATIC_NAV_THEME = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: 'transparent',
    card: 'transparent',
  },
};

/** One-off flows that should not reopen after a restart; the app comes back to where they started. */
const TRANSIENT_ROUTES = new Set([
  'VoiceEntry',
  'Search',
  'SmsSetup',
  'AddTransaction',
  'AddObligation',
  'AddWealthAsset',
  'SmsSenderPicker',
  'SmsSenderConfirm',
]);

function withoutTransientRoutes(state: unknown): unknown {
  const s = state as { routes?: { name: string }[]; index?: number } | null;
  if (!s?.routes) {
    return state;
  }
  const routes = s.routes.filter(r => !TRANSIENT_ROUTES.has(r.name));
  if (routes.length === 0) {
    return undefined;
  }
  return { ...s, routes, index: Math.min(s.index ?? routes.length - 1, routes.length - 1) };
}

export function RootNavigator() {
  useCloudAuthLinks();
  const { stackAnimation } = useAppMotion();
  const completed = useFinanceStore(s => s.snapshot.settings.onboardingCompleted);
  const ingestSms = useFinanceStore(s => s.ingestSms);
  const runIncrementalSmsSync = useFinanceStore(s => s.runIncrementalSmsSync);
  const smsSync = useFinanceStore(s => s.smsSync);
  const flushCloud = useFinanceStore(s => s.flushCloud);
  const [ready, setReady] = useState(false);
  const [initialState, setInitialState] = useState<
    NavigationState | PartialState<NavigationState> | undefined
  >();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoSyncAt = useRef(0);
  const appState = useRef(AppState.currentState);

  const triggerIncrementalSync = useCallback(() => {
    const settings = useFinanceStore.getState().snapshot.settings;
    if (!settings.smsProcessingEnabled) {
      return;
    }
    const now = Date.now();
    // Debounce rapid foreground churn / remounts (not a hard sync limit)
    if (now - lastAutoSyncAt.current < 8_000) {
      return;
    }
    lastAutoSyncAt.current = now;
    void runIncrementalSmsSync();
  }, [runIncrementalSmsSync]);

  useEffect(() => {
    return subscribeIncomingSms(
      payload => {
        ingestSms(payload);
      },
      {
        onRescanNeeded: () => {
          triggerIncrementalSync();
        },
      },
    );
  }, [ingestSms, triggerIncrementalSync]);

  useEffect(() => {
    // Initial app entry sync (once navigator mounts)
    triggerIncrementalSync();
    void runSmartAlerts();
    useFinanceStore.getState().touchNetWorth();
    void checkForUpdate();

    const onChange = (next: AppStateStatus) => {
      const prev = appState.current;
      appState.current = next;
      setCloudAutoRefresh(next === 'active');
      if (prev.match(/inactive|background/) && next === 'active') {
        triggerIncrementalSync();
        pushWidgetState();
        void runSmartAlerts();
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    const stopWatching = watchSmartAlerts();
    const stopWidget = watchWidget();
    return () => {
      sub.remove();
      stopWatching();
      stopWidget();
    };
  }, [triggerIncrementalSync]);

  useEffect(() => {
    const id = setInterval(() => {
      void flushCloud();
    }, 60_000);
    void flushCloud();
    return () => clearInterval(id);
  }, [flushCloud]);

  useEffect(() => {
    try {
      const done = useFinanceStore.getState().snapshot.settings.onboardingCompleted;
      if (done) {
        const raw = getStorageDriver().get(NAV_STATE_KEY);
        if (raw) {
          setInitialState(JSON.parse(raw));
        }
      }
    } catch {
      // ignore corrupt state
    }
    setReady(true);
  }, []);

  const onStateChange = useCallback((state: unknown) => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }
    saveTimer.current = setTimeout(() => {
      try {
        const kept = state ? withoutTransientRoutes(state) : undefined;
        if (kept) {
          getStorageDriver().set(NAV_STATE_KEY, JSON.stringify(kept));
        }
      } catch {
        // ignore
      }
    }, 400);
  }, []);

  if (!ready) {
    return null;
  }

  const showSyncBanner =
    smsSync.status === 'scanning' || smsSync.status === 'completed' || smsSync.status === 'error';

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer
        theme={STATIC_NAV_THEME}
        initialState={initialState}
        onStateChange={onStateChange}>
        <Stack.Navigator
          screenOptions={{ headerShown: false, animation: stackAnimation, freezeOnBlur: true }}
          screenLayout={screenErrorLayout}
          initialRouteName={completed ? 'Main' : 'Onboarding'}>
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="SmsSetup" component={SmsSetupScreen} />
          <Stack.Screen name="SmsOnboarding" component={SmsOnboardingCanvas} />
          <Stack.Screen name="SmsSenderPicker" component={SmsSenderPickerScreen} />
          <Stack.Screen name="SmsSenderConfirm" component={SmsSenderConfirmCanvas} />
          <Stack.Screen name="BankSendersManage" component={BankSendersManageCanvas} />
          <Stack.Screen name="SmsTest" component={SmsTestGateScreen} />
          <Stack.Screen
            name="SmsParserLab"
            component={__DEV__ ? SmsParserLabScreen : SettingsBanksSmsScreen}
          />
          <Stack.Screen name="Auth" component={AuthCanvas} />
          <Stack.Screen name="Main" component={MainScreen} />
          <Stack.Screen name="Transactions" component={TransactionsScreen} />
          <Stack.Screen name="TransactionDetails" component={TransactionDetailsScreen} />
          <Stack.Screen name="AddTransaction" component={AddTransactionScreen} />
          <Stack.Screen name="VoiceEntry" component={VoiceEntryScreen} />
          <Stack.Screen name="Search" component={SearchScreen} />
          <Stack.Screen name="Budgets" component={BudgetsScreen} />
          <Stack.Screen name="Tools" component={ToolsScreen} />
          <Stack.Screen name="Obligations" component={ObligationsScreen} />
          <Stack.Screen name="AddObligation" component={AddObligationScreen} />
          <Stack.Screen name="Insights" component={InsightsRedirect} />
          <Stack.Screen name="Analytics" component={AnalyticsRedirect} />
          <Stack.Screen name="Recap" component={RecapRedirect} />
          <Stack.Screen name="Calendar" component={CalendarRedirect} />
          <Stack.Screen name="DailyLedger" component={DailyLedgerScreen} />
          <Stack.Screen name="Assistant" component={AssistantRedirect} />
          <Stack.Screen name="AccountProfile" component={ProfileScreen} />
          <Stack.Screen name="Settings" component={SettingsHomeScreen} />
          <Stack.Screen name="SettingsFinancial" component={SettingsFinancialScreen} />
          <Stack.Screen name="SettingsBanksSms" component={SettingsBanksSmsScreen} />
          <Stack.Screen name="SettingsAccounts" component={SettingsAccountsScreen} />
          <Stack.Screen name="SettingsBudgets" component={SettingsBudgetsScreen} />
          <Stack.Screen name="SettingsReports" component={SettingsReportsScreen} />
          <Stack.Screen name="SettingsAssets" component={SettingsAssetsScreen} />
          <Stack.Screen name="SettingsPrices" component={SettingsPricesScreen} />
          <Stack.Screen name="SettingsInsights" component={SettingsInsightsScreen} />
          <Stack.Screen name="SettingsNotifications" component={SettingsNotificationsPrefsScreen} />
          <Stack.Screen name="SettingsSecurity" component={SettingsSecurityScreen} />
          <Stack.Screen name="SettingsBackup" component={SettingsBackupScreen} />
          <Stack.Screen name="SettingsCloud" component={SettingsCloudScreen} />
          <Stack.Screen name="SettingsData" component={SettingsDataScreen} />
          <Stack.Screen name="SettingsAppearance" component={SettingsAppearanceScreen} />
          <Stack.Screen name="SettingsLanguage" component={SettingsLanguageScreen} />
          <Stack.Screen name="SettingsDeveloper" component={SettingsDeveloperScreen} />
          <Stack.Screen name="SettingsSupport" component={SettingsSupportScreen} />
          <Stack.Screen name="SettingsAbout" component={SettingsAboutScreen} />
          <Stack.Screen name="ReviewInbox" component={ReviewInboxScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="Goals" component={GoalsRedirect} />
          <Stack.Screen name="Recurring" component={RecurringRedirect} />
          <Stack.Screen
            name="CinematicBalance"
            component={CinematicBalanceScreen}
            options={{ animation: stackAnimation === 'none' ? 'none' : 'fade' }}
          />
          <Stack.Screen name="Privacy" component={PrivacyCanvas} />
          <Stack.Screen name="AssetDetail" component={AssetDetailScreen} />
          <Stack.Screen name="AddWealthAsset" component={AddWealthAssetScreen} />
        </Stack.Navigator>
      </NavigationContainer>
      {showSyncBanner && smsSync.message ? (
        <SmsSyncBanner message={smsSync.message} status={smsSync.status} />
      ) : null}
    </View>
  );
}

function SmsSyncBanner({ message, status }: { message: string; status: string }) {
  const insets = useSafeAreaInsets();
  const bg =
    status === 'error'
      ? 'rgba(180,60,60,0.92)'
      : status === 'completed'
      ? 'rgba(30,110,80,0.92)'
      : 'rgba(20,40,44,0.92)';
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: insets.top + 6,
        alignSelf: 'center',
        maxWidth: '88%',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
      }}>
      <AppText style={{ color: '#F4FFFB', fontSize: 12, textAlign: 'center' }}>{message}</AppText>
    </View>
  );
}
