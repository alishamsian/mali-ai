import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { AppText } from '../../../components/ui/AppText';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { theme } from '../../../theme';
import type { ThemeSnapshot } from '../../../theme/runtime';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { interpolate, t } from '../../../i18n';
import { useFinanceStore } from '../../../store/finance/store';
import { isCloudSyncAvailable, APP_FEATURES } from '../../../app/config/features';
import { navigateSmsHub } from '../../../app/navigation/smsNavigation';
import type { RootStackParamList } from '../../../app/navigation/types';
import { navigateRoot } from '../../../app/navigation/navigateRoot';
import {
  SettingsNavRow,
  SettingsScreenHeader,
  SettingsSection,
  SettingsToggleRow,
} from '../components/SettingsUI';
import { withSettingsDefaults } from '../lib/settingsDefaults';
import { resolveBankName } from '../../banks/names';
import { useSettings } from '../lib/useSettings';
import { toPersianDigits } from '../../../utils/numbers/digits';
import { toJalaliLabel } from '../../../utils/dates/jalali';
import {
  clearPinHash,
  hasStoredPin,
  pinLooksValid,
  storePin,
} from '../../../services/security/pin';
import {
  biometricAvailable,
  clearVaultToken,
  enrollVaultToken,
} from '../../../services/security/vault';
import {
  backupPasswordValid,
  encryptSnapshotBackup,
  isEncryptedBackupJson,
} from '../../../services/security/backupCrypto';
import { useAuthStore } from '../../../store/auth/store';
import { hapticSuccess, hapticWarn } from '../../../utils/haptics';
import { providerForClass } from '../../wealth/pricing/providers';
import { ACCENT_PRESETS } from '../../../theme/accentPresets';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { formatCrashReport, getCrashLog } from '../../../services/crash/crashLog';
import { APP_VERSION } from '../../../app/config/version';
import { isSupabaseConfigured } from '../../../services/supabase/client';
import {
  emailLooksValid,
  getCloudUser,
  onCloudUserChange,
  sendEmailCode,
  signOutCloud,
  verifyEmailCode,
  type CloudUser,
} from '../../../services/supabase/auth';
type Nav = NativeStackNavigationProp<RootStackParamList>;

function createCategoryStyles(colors: ThemeSnapshot['colors'], t: typeof theme) {
  return {
    hint: {
      textAlign: 'right' as const,
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 18,
      marginTop: 8,
      marginBottom: 12,
    },
    dayRow: { flexDirection: 'row-reverse' as const, gap: 8, padding: 12 },
    dayChip: {
      minWidth: 48,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center' as const,
    },
    dayChipOn: {
      borderColor: colors.primary,
      backgroundColor: t.palette.primaryGlow,
    },
    input: {
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
      paddingHorizontal: 14,
      backgroundColor: colors.surfaceSolid,
      marginBottom: 8,
    },
    restoreInput: {
      minHeight: 140,
      textAlignVertical: 'top' as const,
      paddingVertical: 12,
    },
    about: { alignItems: 'center' as const, paddingVertical: 32, gap: 8 },
    aboutName: {
      fontSize: 28,
      fontFamily: t.typography.fontFamily.semibold,
    },
    aboutMeta: { fontSize: 13, color: colors.textMuted, textAlign: 'center' as const },
    aboutMaker: {
      marginTop: 12,
      fontSize: 14,
      textAlign: 'center' as const,
      fontFamily: t.typography.fontFamily.medium,
    },
    accentGrid: {
      flexDirection: 'row-reverse' as const,
      flexWrap: 'wrap' as const,
      gap: 10,
      padding: 14,
    },
    accentChip: {
      width: '30%' as const,
      minWidth: 96,
      flexGrow: 1,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      paddingVertical: 12,
      paddingHorizontal: 10,
      alignItems: 'center' as const,
      gap: 8,
    },
    accentDot: {
      width: 22,
      height: 22,
      borderRadius: 11,
    },
    accentLabel: {
      fontSize: 12,
      color: colors.text,
      textAlign: 'center' as const,
    },
  };
}


function Shell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const dict = t();
  return (
    <NightCanvas>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 10,
          paddingBottom: 48,
          paddingHorizontal: 16,
        }}
        keyboardShouldPersistTaps="handled">
        <SettingsScreenHeader
          title={title}
          backLabel={dict.common.back}
          onBack={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigateRoot(navigation, 'Settings');
            }
          }}
        />
        {children}
      </ScrollView>
    </NightCanvas>
  );
}

export function SettingsFinancialScreen() {
  const styles = useThemedStyles(createCategoryStyles);
  const dict = t();
  const settings = useSettings();
  const update = useFinanceStore(s => s.updateSettings);
  const { colors } = useAppTheme();
  return (
    <Shell title={dict.settings.categories.financial}>
      <SettingsSection title={dict.settings.sections.currency}>
        <SettingsToggleRow
          title={dict.settings.displayAsToman}
          subtitle={dict.settings.displayAsTomanHint}
          value={settings.displayCurrency === 'IRT'}
          onValueChange={v => update({ displayCurrency: v ? 'IRT' : 'IRR' })}
        />
        <SettingsNavRow
          title={dict.settings.calendarJalali}
          subtitle={
            settings.calendar === 'jalali'
              ? dict.settings.status.active
              : dict.settings.calendarGregorian
          }
          onPress={() =>
            update({ calendar: settings.calendar === 'jalali' ? 'gregorian' : 'jalali' })
          }
          last
        />
      </SettingsSection>
      <SettingsSection title={dict.settings.sections.month}>
        <AppText style={styles.hint}>{dict.settings.monthStartHint}</AppText>
        <View style={styles.dayRow}>
          {[1, 15, 21].map(d => (
            <Pressable
              key={d}
              onPress={() => update({ financialMonthStartDay: d })}
              style={[
                styles.dayChip,
                settings.financialMonthStartDay === d && styles.dayChipOn,
              ]}>
              <AppText
                style={{
                  color:
                    settings.financialMonthStartDay === d ? colors.primary : colors.text,
                }}>
                {toPersianDigits(String(d))}
              </AppText>
            </Pressable>
          ))}
        </View>
      </SettingsSection>
    </Shell>
  );
}

export function SettingsBanksSmsScreen() {
  const styles = useThemedStyles(createCategoryStyles);
  const dict = t();
  const navigation = useNavigation<Nav>();
  const snapshot = useFinanceStore(s => s.snapshot);
  const smsSync = useFinanceStore(s => s.smsSync);
  const runSmsSync = useFinanceStore(s => s.runIncrementalSmsSync);
  const settings = withSettingsDefaults(snapshot.settings);
  const connections = settings.bankConnections ?? [];
  const bankCount = connections.filter(c => c.verifiedSenders.length > 0).length;
  const unknown = snapshot.unknownSms.length;
  const review = snapshot.transactions.filter(t => t.needsReview && !t.isConfirmed).length;
  const last = smsSync.lastResult;
  const syncDebug =
    last &&
    `اسکن ${last.scannedCount} · تراکنش ${last.createdCount} · ناشناس ${last.unknownCount} · تکراری ${last.duplicateCount}`;

  return (
    <Shell title={dict.settings.categories.banksSms}>
      <SettingsSection title={dict.settings.sections.smsStatus}>
        <SettingsNavRow
          title={dict.settings.smsAccess}
          subtitle={settings.smsProcessingEnabled ? dict.settings.status.on : dict.settings.status.off}
          onPress={() => navigateSmsHub(navigation, settings.smsProcessingEnabled)}
        />
        <SettingsNavRow
          title={dict.settings.lastScan}
          subtitle={
            settings.smsLastInboxAt
              ? toJalaliLabel(settings.smsLastInboxAt)
              : dict.settings.syncNever
          }
          onPress={() => {
            if (settings.smsProcessingEnabled) {
              void runSmsSync();
            } else {
              navigateSmsHub(navigation, false);
            }
          }}
        />
        {APP_FEATURES.devTools && syncDebug ? (
          <SettingsNavRow
            title="آخرین همگام‌سازی SMS (دیباگ)"
            subtitle={syncDebug}
            onPress={() => navigateRoot(navigation, 'ReviewInbox')}
          />
        ) : null}
        <SettingsNavRow
          title={dict.settings.connectedBanks}
          subtitle={`${toPersianDigits(String(bankCount))} ${dict.settings.bankUnit}`}
          onPress={() => navigateRoot(navigation, 'SmsOnboarding')}
        />
        <SettingsNavRow
          title={dict.settings.unknownSms}
          subtitle={toPersianDigits(String(unknown))}
          onPress={() => navigateRoot(navigation, 'ReviewInbox')}
        />
        <SettingsNavRow
          title={dict.settings.needsReview}
          subtitle={toPersianDigits(String(review))}
          onPress={() => navigateRoot(navigation, 'ReviewInbox')}
          last
        />
      </SettingsSection>
      <SettingsSection title={dict.sms.verifiedSendersSection}>
        {connections.map(conn => {
          const senders =
            conn.verifiedSenders?.map(s => s.sender).join(' · ') || dict.sms.pendingSender;
          return (
            <SettingsNavRow
              key={conn.id}
              title={resolveBankName(conn.bankId)}
              subtitle={senders}
              onPress={() => navigateRoot(navigation, 'BankSendersManage', { bankId: conn.bankId })}
              last={false}
            />
          );
        })}
        <SettingsNavRow
          title={dict.sms.addBankConnection}
          subtitle={dict.sms.connectBankHint}
          onPress={() => navigateRoot(navigation, 'SmsOnboarding')}
          last
        />
      </SettingsSection>
      <SettingsSection title={dict.settings.sections.actions}>
        <SettingsNavRow
          title={dict.settings.openSmsSetup}
          onPress={() => navigateRoot(navigation, 'SmsOnboarding')}
        />
        {settings.smsProcessingEnabled ? (
          <PrimaryButton
            label={dict.sms.scanInbox}
            onPress={() => void runSmsSync()}
          />
        ) : null}
        {APP_FEATURES.devTools ? (
          <>
            <SettingsNavRow
              title={dict.settings.openSmsTest}
              onPress={() => navigateRoot(navigation, 'SmsTest')}
            />
            <SettingsNavRow
              title={dict.settings.openParserLab}
              onPress={() => navigateRoot(navigation, 'SmsParserLab')}
              last
            />
          </>
        ) : null}
      </SettingsSection>
      <AppText style={styles.hint}>{dict.settings.smsNoDuplicateHint}</AppText>
    </Shell>
  );
}

export function SettingsAccountsScreen() {
  const dict = t();
  const navigation = useNavigation<Nav>();
  const snapshot = useFinanceStore(s => s.snapshot);
  const update = useFinanceStore(s => s.updateSettings);
  const settings = withSettingsDefaults(snapshot.settings);
  const accounts = snapshot.accounts.filter(
    a => a.kind === 'bank' || a.kind === 'cash' || a.kind === 'card',
  );

  const pickDefault = () => {
    if (accounts.length === 0) {
      navigateRoot(navigation, 'Main', { screen: 'Vault' });
      return;
    }
    Alert.alert(
      dict.settings.defaultAccount,
      dict.settings.pickDefaultAccount,
      [
        ...accounts.map(a => ({
          text: a.id === settings.defaultAccountId ? `✓ ${a.name}` : a.name,
          onPress: () => update({ defaultAccountId: a.id }),
        })),
        { text: dict.common.cancel, style: 'cancel' as const },
      ],
    );
  };

  return (
    <Shell title={dict.settings.categories.accountsPayments}>
      <SettingsSection title={dict.settings.sections.accounts}>
        <SettingsNavRow
          title={dict.settings.manageAccounts}
          subtitle={`${toPersianDigits(String(snapshot.accounts.length))} ${dict.settings.itemUnit}`}
          onPress={() => navigateRoot(navigation, 'Main', { screen: 'Vault' })}
        />
        <SettingsNavRow
          title={dict.settings.defaultAccount}
          subtitle={
            accounts.find(a => a.id === settings.defaultAccountId)?.name ?? dict.settings.notSet
          }
          onPress={pickDefault}
        />
        <SettingsNavRow
          title={dict.settings.categories.assetsValuation}
          subtitle={dict.settings.assetsReuseHint}
          onPress={() => navigateRoot(navigation, 'SettingsAssets')}
        />
        <SettingsNavRow
          title={dict.settings.categories.currenciesPrices}
          subtitle={dict.settings.pricesHonestHint}
          onPress={() => navigateRoot(navigation, 'SettingsPrices')}
          last
        />
      </SettingsSection>
    </Shell>
  );
}

export function SettingsBudgetsScreen() {
  const dict = t();
  const navigation = useNavigation<Nav>();
  const settings = useSettings();
  const update = useFinanceStore(s => s.updateSettings);
  return (
    <Shell title={dict.settings.categories.budgetsGoals}>
      <SettingsSection title={dict.settings.sections.prefs}>
        <SettingsToggleRow
          title={dict.settings.budgetAlerts}
          subtitle={dict.settings.budgetAlertsHint}
          value={settings.budgetAlertsEnabled}
          onValueChange={v => update({ budgetAlertsEnabled: v })}
          last
        />
      </SettingsSection>
      <SettingsSection title={dict.settings.sections.open}>
        <SettingsNavRow title={dict.budgets.hubTitle} onPress={() => navigateRoot(navigation, 'Budgets')} last />
      </SettingsSection>
    </Shell>
  );
}

export function SettingsReportsScreen() {
  const dict = t();
  const navigation = useNavigation<Nav>();
  return (
    <Shell title={dict.settings.categories.reportsCategories}>
      <SettingsSection title={dict.settings.sections.open}>
        <SettingsNavRow
          title={dict.nav.analytics}
          onPress={() => navigateRoot(navigation, 'Main', { screen: 'Analytics' })}
          last
        />
      </SettingsSection>
    </Shell>
  );
}

export function SettingsAssetsScreen() {
  const styles = useThemedStyles(createCategoryStyles);
  const dict = t();
  const navigation = useNavigation<Nav>();
  const settings = useSettings();
  const update = useFinanceStore(s => s.updateSettings);
  return (
    <Shell title={dict.settings.categories.assetsValuation}>
      <SettingsSection title={dict.settings.sections.prefs}>
        <SettingsToggleRow
          title={dict.settings.autoPriceUpdates}
          subtitle={dict.settings.autoPriceUpdatesHint}
          value={Boolean(settings.autoPriceUpdates)}
          onValueChange={v => update({ autoPriceUpdates: v })}
          last
        />
      </SettingsSection>
      <SettingsSection title={dict.settings.sections.open}>
        <SettingsNavRow
          title={dict.wealth.title}
          onPress={() => navigateRoot(navigation, 'Main', { screen: 'Vault' })}
        />
        <SettingsNavRow
          title={dict.settings.addAsset}
          onPress={() => navigateRoot(navigation, 'AddWealthAsset')}
          last
        />
      </SettingsSection>
      <AppText style={styles.hint}>{dict.settings.assetsReuseHint}</AppText>
    </Shell>
  );
}

export function SettingsPricesScreen() {
  const styles = useThemedStyles(createCategoryStyles);
  const dict = t();
  const navigation = useNavigation<Nav>();
  const settings = useSettings();
  const update = useFinanceStore(s => s.updateSettings);
  const refreshWealthPrices = useFinanceStore(s => s.refreshWealthPrices);

  const onRefresh = async () => {
    const count = await refreshWealthPrices();
    hapticSuccess();
    Alert.alert(
      dict.settings.refreshPrices,
      count > 0
        ? interpolate(dict.settings.refreshPricesDone, { count })
        : dict.settings.refreshPricesEmpty,
    );
  };

  return (
    <Shell title={dict.settings.categories.currenciesPrices}>
      <SettingsSection title={dict.settings.sections.prefs}>
        <SettingsToggleRow
          title={dict.settings.autoPriceToggle}
          subtitle={dict.settings.autoPriceUpdatesHint}
          value={Boolean(settings.autoPriceUpdates)}
          onValueChange={v => update({ autoPriceUpdates: v })}
          last
        />
      </SettingsSection>
      <PrimaryButton label={dict.settings.refreshPrices} onPress={() => void onRefresh()} />
      <View style={{ height: 12 }} />
      <SettingsSection title={dict.settings.sections.providers}>
        {(['gold', 'silver', 'currency', 'crypto', 'stock'] as const).map((cls, i, arr) => {
          const provider = providerForClass(cls);
          return (
            <SettingsNavRow
              key={cls}
              title={dict.wealth.classes[cls]}
              subtitle={`${dict.settings.provider}: ${provider.id} · ${dict.settings.sourceLive}`}
              onPress={() => {
                Alert.alert(dict.settings.providerTitle, dict.settings.providerBody);
              }}
              last={i === arr.length - 1}
            />
          );
        })}
      </SettingsSection>
      <SettingsSection title={dict.settings.sections.open}>
        <SettingsNavRow
          title={dict.settings.openWealth}
          onPress={() => navigateRoot(navigation, 'Main', { screen: 'Vault' })}
          last
        />
      </SettingsSection>
      <AppText style={styles.hint}>{dict.settings.pricesHonestHint}</AppText>
    </Shell>
  );
}

export function SettingsInsightsScreen() {
  const dict = t();
  const navigation = useNavigation<Nav>();
  const settings = useSettings();
  const update = useFinanceStore(s => s.updateSettings);
  return (
    <Shell title={dict.settings.categories.insights}>
      <SettingsSection title={dict.settings.sections.prefs}>
        <SettingsToggleRow
          title={dict.settings.insightsEnabled}
          subtitle={dict.settings.insightsEnabledHint}
          value={Boolean(settings.insightsEnabled)}
          onValueChange={v => update({ insightsEnabled: v })}
          last
        />
      </SettingsSection>
      <SettingsSection title={dict.settings.sections.open}>
        <SettingsNavRow
          title={dict.analyticsHub.intel}
          onPress={() =>
            navigateRoot(navigation, 'Main', { screen: 'Analytics', params: { section: 'intel' } })
          }
          last
        />
      </SettingsSection>
    </Shell>
  );
}

export function SettingsNotificationsPrefsScreen() {
  const dict = t();
  const navigation = useNavigation<Nav>();
  const settings = useSettings();
  const update = useFinanceStore(s => s.updateSettings);
  const prefs = settings.notificationPrefs!;

  return (
    <Shell title={dict.settings.categories.notifications}>
      <SettingsSection title={dict.settings.sections.master}>
        <SettingsToggleRow
          title={dict.settings.masterNotifications}
          value={settings.notificationsEnabled}
          onValueChange={v => update({ notificationsEnabled: v })}
          last
        />
      </SettingsSection>
      <SettingsSection title={dict.settings.sections.categories}>
        {(
          [
            ['transactions', dict.settings.notifTx],
            ['assets', dict.settings.notifAssets],
            ['budgets', dict.settings.notifBudgets],
            ['goals', dict.settings.notifGoals],
            ['system', dict.settings.notifSystem],
          ] as const
        ).map(([key, label], i, arr) => (
          <SettingsToggleRow
            key={key}
            title={label}
            value={prefs[key]}
            disabled={!settings.notificationsEnabled}
            onValueChange={v =>
              update({
                notificationPrefs: { ...prefs, [key]: v },
              })
            }
            last={i === arr.length - 1}
          />
        ))}
      </SettingsSection>
      <SettingsSection title={dict.settings.sections.open}>
        <SettingsNavRow
          title={dict.settings.notificationInbox}
          subtitle={dict.settings.notificationInboxHint}
          onPress={() => navigateRoot(navigation, 'Notifications')}
          last
        />
      </SettingsSection>
    </Shell>
  );
}

export function SettingsSecurityScreen() {
  const styles = useThemedStyles(createCategoryStyles);
  const { colors } = useAppTheme();
  const dict = t();
  const navigation = useNavigation<Nav>();
  const snapshot = useFinanceStore(s => s.snapshot);
  const update = useFinanceStore(s => s.updateSettings);
  const unlockVault = useAuthStore(s => s.unlockVault);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const settings = withSettingsDefaults(snapshot.settings);

  const toggleLock = async (v: boolean) => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      if (!v) {
        update({ appLockEnabled: false, biometricUnlock: false });
        await clearPinHash();
        await clearVaultToken();
        unlockVault();
        setPin('');
        return;
      }
      if (!pinLooksValid(pin)) {
        hapticWarn();
        Alert.alert(dict.profile.pinNeededTitle, dict.profile.pinNeededBody);
        return;
      }
      await storePin(pin);
      if (!(await hasStoredPin())) {
        Alert.alert(dict.profile.lockErrorTitle, dict.profile.lockErrorBody);
        return;
      }
      update({ appLockEnabled: true, biometricUnlock: false });
      setPin('');
      unlockVault();
      hapticSuccess();
    } catch {
      update({ appLockEnabled: false });
      Alert.alert(dict.profile.lockErrorTitle, dict.profile.lockErrorBody);
    } finally {
      setBusy(false);
    }
  };

  const toggleBio = async (v: boolean) => {
    if (busy || !settings.appLockEnabled) {
      return;
    }
    setBusy(true);
    try {
      if (!v) {
        await clearVaultToken();
        update({ biometricUnlock: false });
        return;
      }
      if (!(await biometricAvailable())) {
        Alert.alert(dict.profile.bioUnavailableTitle, dict.profile.bioUnavailableBody);
        update({ biometricUnlock: false });
        return;
      }
      const ok = await enrollVaultToken();
      update({ biometricUnlock: ok });
      if (!ok) {
        Alert.alert(dict.profile.bioFailedTitle, dict.profile.bioFailedBody);
      } else {
        hapticSuccess();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title={dict.settings.categories.security}>
      <SettingsSection title={dict.settings.sections.security}>
        <SettingsToggleRow
          title={dict.profile.appLock}
          value={settings.appLockEnabled}
          onValueChange={v => void toggleLock(v)}
          disabled={busy}
        />
        <SettingsToggleRow
          title={dict.profile.biometric}
          value={Boolean(settings.biometricUnlock)}
          onValueChange={v => void toggleBio(v)}
          disabled={busy || !settings.appLockEnabled}
        />
        <SettingsToggleRow
          title={dict.profile.hideBalance}
          value={settings.hideBalances}
          onValueChange={v => update({ hideBalances: v })}
          last
        />
      </SettingsSection>
      <TextInput
        value={pin}
        onChangeText={v => setPin(v.replace(/\D/g, '').slice(0, 6))}
        placeholder={settings.appLockEnabled ? dict.profile.changePin : dict.profile.setPin}
        placeholderTextColor={colors.textMuted}
        keyboardType="number-pad"
        secureTextEntry
        textAlign="right"
        maxLength={6}
        style={styles.input}
      />
      <AppText style={styles.hint}>{dict.profile.pinSetupHint}</AppText>
      {settings.appLockEnabled ? (
        <PrimaryButton
          label={dict.settings.changePinAction}
          onPress={() => {
            if (!pinLooksValid(pin)) {
              hapticWarn();
              Alert.alert(dict.profile.pinNeededTitle, dict.profile.pinNeededBody);
              return;
            }
            void (async () => {
              try {
                await storePin(pin);
              } catch {
                // The old PIN is still the one in the Keychain; say so instead of "changed".
                hapticWarn();
                Alert.alert(dict.profile.lockErrorTitle, dict.profile.lockErrorBody);
                return;
              }
              setPin('');
              hapticSuccess();
              Alert.alert(dict.profile.pinChangedTitle, dict.profile.pinChangedBody);
            })();
          }}
        />
      ) : null}
      <View style={{ height: 12 }} />
      <SettingsSection title={dict.settings.sections.open}>
        <SettingsNavRow
          title={dict.profile.privacy}
          onPress={() => navigateRoot(navigation, 'Privacy')}
          last
        />
      </SettingsSection>
    </Shell>
  );
}

export function SettingsCloudScreen() {
  const styles = useThemedStyles(createCategoryStyles);
  const { colors } = useAppTheme();
  const dict = t();
  const copy = dict.cloud;
  const lastFlush = useFinanceStore(s => s.snapshot.settings.lastCloudFlushAt);
  const pending = useFinanceStore(s => s.snapshot.syncQueue.length);
  const flushCloud = useFinanceStore(s => s.flushCloud);
  const enqueueFullUpload = useFinanceStore(s => s.enqueueFullUpload);
  const restoreFromCloud = useFinanceStore(s => s.restoreFromCloud);
  const [user, setUser] = useState<CloudUser | null>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void getCloudUser().then(u => alive && setUser(u));
    const unsubscribe = onCloudUserChange(u => alive && setUser(u));
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const run = async (task: () => Promise<void>) => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await task();
    } finally {
      setBusy(false);
    }
  };

  const send = () =>
    run(async () => {
      if (!emailLooksValid(email)) {
        hapticWarn();
        Alert.alert(copy.invalidEmail);
        return;
      }
      const result = await sendEmailCode(email);
      if (!result.ok) {
        hapticWarn();
        Alert.alert(copy.failedTitle, copy.failedBody);
        return;
      }
      setCodeSentTo(email.trim().toLowerCase());
      setCode('');
    });

  const verify = () =>
    run(async () => {
      if (!codeSentTo) {
        return;
      }
      if (code.replace(/\D/g, '').length < 6) {
        hapticWarn();
        Alert.alert(copy.invalidCode);
        return;
      }
      const result = await verifyEmailCode(codeSentTo, code);
      if (!result.ok) {
        hapticWarn();
        Alert.alert(copy.failedTitle, copy.failedBody);
        return;
      }
      setCodeSentTo(null);
      setCode('');
      // Everything already on the phone goes up once; later edits queue themselves.
      enqueueFullUpload();
      void flushCloud();
      hapticSuccess();
      Alert.alert(copy.signedInTitle, copy.signedInBody);
    });

  const restore = () =>
    run(async () => {
      const result = await restoreFromCloud();
      if (!result.ok) {
        hapticWarn();
        Alert.alert(copy.restore, copy.restoreFailed);
        return;
      }
      hapticSuccess();
      Alert.alert(
        copy.restore,
        result.addedTransactions + result.addedAccounts === 0
          ? copy.restoreNothing
          : interpolate(copy.restoreDone, {
              transactions: toPersianDigits(result.addedTransactions),
              accounts: toPersianDigits(result.addedAccounts),
            }),
      );
    });

  if (!isSupabaseConfigured()) {
    return (
      <Shell title={copy.title}>
        <AppText style={styles.hint}>{copy.notConfigured}</AppText>
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell title={copy.title}>
        <AppText style={styles.hint}>{copy.intro}</AppText>
        {codeSentTo ? (
          <>
            <AppText style={styles.hint}>
              {interpolate(copy.codeSent, { email: codeSentTo })}
            </AppText>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder={copy.codePlaceholder}
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={8}
              textAlign="center"
              style={styles.input}
            />
            <PrimaryButton label={copy.verify} onPress={() => void verify()} disabled={busy} />
            <SettingsNavRow title={copy.changeEmail} onPress={() => setCodeSentTo(null)} last />
          </>
        ) : (
          <>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={copy.emailPlaceholder}
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textAlign="left"
              style={styles.input}
            />
            <PrimaryButton label={copy.sendCode} onPress={() => void send()} disabled={busy} />
          </>
        )}
      </Shell>
    );
  }

  return (
    <Shell title={copy.title}>
      <AppText style={styles.hint}>{`${copy.signedInAs}: ${user.email ?? user.id}`}</AppText>
      <SettingsSection title={dict.settings.sections.sync}>
        <SettingsNavRow
          title={copy.syncNow}
          subtitle={`${lastFlush ? toJalaliLabel(lastFlush) : dict.settings.syncNever} · ${interpolate(
            copy.pending,
            { count: toPersianDigits(pending) },
          )}`}
          onPress={() => void run(flushCloud)}
        />
        <SettingsNavRow
          title={copy.restore}
          subtitle={copy.restoreHint}
          onPress={() => void restore()}
          last
        />
      </SettingsSection>
      <SettingsSection title={dict.settings.sections.danger}>
        <SettingsNavRow
          title={copy.signOut}
          subtitle={copy.signOutConfirm}
          onPress={() =>
            Alert.alert(copy.signOut, copy.signOutConfirm, [
              { text: dict.common.cancel, style: 'cancel' },
              {
                text: dict.common.confirm,
                style: 'destructive',
                onPress: () => void run(signOutCloud),
              },
            ])
          }
          last
        />
      </SettingsSection>
      <AppText style={styles.hint}>{copy.notSynced}</AppText>
    </Shell>
  );
}

export function SettingsBackupScreen() {
  const styles = useThemedStyles(createCategoryStyles);
  const { colors } = useAppTheme();
  const dict = t();
  const navigation = useNavigation<Nav>();
  const snapshot = useFinanceStore(s => s.snapshot);
  const flushCloud = useFinanceStore(s => s.flushCloud);
  const update = useFinanceStore(s => s.updateSettings);
  const importBackupJson = useFinanceStore(s => s.importBackupJson);
  const settings = withSettingsDefaults(snapshot.settings);
  const cloud = isCloudSyncAvailable();
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreText, setRestoreText] = useState('');
  const [exportPassword, setExportPassword] = useState('');
  const [exportPasswordConfirm, setExportPasswordConfirm] = useState('');
  const [restorePassword, setRestorePassword] = useState('');

  const exportFull = async () => {
    if (!backupPasswordValid(exportPassword)) {
      hapticWarn();
      Alert.alert(dict.settings.backupPasswordTitle, dict.settings.backupPasswordShort);
      return;
    }
    if (exportPassword !== exportPasswordConfirm) {
      hapticWarn();
      Alert.alert(dict.settings.backupPasswordTitle, dict.settings.backupPasswordMismatch);
      return;
    }
    const payload = encryptSnapshotBackup(snapshot, exportPassword);
    await Share.share({ message: payload, title: dict.settings.backupShareTitle });
    update({ lastManualBackupAt: new Date().toISOString() });
    setExportPassword('');
    setExportPasswordConfirm('');
    hapticSuccess();
  };

  const exportCsv = async () => {
    const header = 'id,date,type,direction,amountRial,merchant,categoryId,accountId';
    const lines = snapshot.transactions.map(tx =>
      [
        tx.id,
        tx.transactionDate,
        tx.type,
        tx.direction,
        tx.amountRial,
        JSON.stringify(tx.merchant ?? ''),
        tx.categoryId,
        tx.accountId,
      ].join(','),
    );
    await Share.share({
      message: [header, ...lines].join('\n'),
      title: dict.settings.exportCsv,
    });
    hapticSuccess();
  };

  const confirmRestore = () => {
    const needsPassword = isEncryptedBackupJson(restoreText.trim());
    if (needsPassword && !backupPasswordValid(restorePassword)) {
      hapticWarn();
      Alert.alert(dict.settings.backupPasswordTitle, dict.settings.backupPasswordRequired);
      return;
    }
    const result = importBackupJson(
      restoreText.trim(),
      needsPassword ? restorePassword : undefined,
    );
    if (result.ok) {
      hapticSuccess();
      setRestoreOpen(false);
      setRestoreText('');
      setRestorePassword('');
      Alert.alert(dict.settings.restoreOk);
      return;
    }
    hapticWarn();
    if (result.error === 'mac' || result.error === 'decrypt') {
      Alert.alert(dict.settings.restoreFail, dict.settings.backupPasswordWrong);
      return;
    }
    Alert.alert(dict.settings.restoreFail);
  };

  return (
    <Shell title={dict.settings.categories.backupSync}>
      {cloud ? (
        <SettingsSection title={dict.settings.sections.sync}>
          <SettingsNavRow
            title={dict.cloud.title}
            subtitle={
              settings.lastCloudFlushAt
                ? `${dict.settings.lastCloudFlush}: ${toJalaliLabel(settings.lastCloudFlushAt)}`
                : dict.cloud.rowHint
            }
            onPress={() => navigateRoot(navigation, 'SettingsCloud')}
            last
          />
        </SettingsSection>
      ) : null}
      <SettingsSection title={dict.settings.sections.actions}>
        <AppText style={styles.hint}>{dict.settings.backupEncryptedHint}</AppText>
        <TextInput
          value={exportPassword}
          onChangeText={setExportPassword}
          placeholder={dict.settings.backupPasswordExport}
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          textAlign="right"
          style={styles.input}
        />
        <TextInput
          value={exportPasswordConfirm}
          onChangeText={setExportPasswordConfirm}
          placeholder={dict.settings.backupPasswordConfirm}
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          textAlign="right"
          style={styles.input}
        />
        <SettingsNavRow
          title={dict.settings.exportFullBackup}
          subtitle={
            settings.lastManualBackupAt
              ? toJalaliLabel(settings.lastManualBackupAt)
              : dict.settings.syncNever
          }
          onPress={() => void exportFull()}
        />
        <SettingsNavRow
          title={dict.settings.restoreBackup}
          subtitle={dict.settings.restoreBackupHint}
          onPress={() => setRestoreOpen(v => !v)}
          last
        />
      </SettingsSection>
          {restoreOpen ? (
        <View style={{ marginBottom: 12 }}>
          <AppText style={styles.hint}>{dict.settings.restorePasteBody}</AppText>
          <TextInput
            value={restorePassword}
            onChangeText={setRestorePassword}
            placeholder={dict.settings.backupPasswordRestore}
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            textAlign="right"
            style={styles.input}
          />
          <TextInput
            value={restoreText}
            onChangeText={setRestoreText}
            placeholder={dict.settings.restorePasteTitle}
            placeholderTextColor={colors.textMuted}
            multiline
            textAlign="right"
            style={[styles.input, styles.restoreInput]}
          />
          <PrimaryButton label={dict.settings.restoreConfirm} onPress={confirmRestore} />
        </View>
      ) : null}
      {cloud ? (
        <PrimaryButton label={dict.settings.syncNow} onPress={() => void flushCloud()} />
      ) : null}
      <View style={{ height: 12 }} />
      <PrimaryButton label={dict.settings.exportCsv} onPress={() => void exportCsv()} />
      <View style={{ height: 12 }} />
      <SettingsNavRow
        title={dict.settings.categories.dataManagement}
        subtitle={dict.settings.dataDangerHint}
        onPress={() => navigateRoot(navigation, 'SettingsData')}
      />
      <AppText style={styles.hint}>
        {cloud ? dict.settings.backupHonestHint : dict.settings.backupLocalHint}
      </AppText>
    </Shell>
  );
}

export function SettingsDataScreen() {
  const styles = useThemedStyles(createCategoryStyles);
  const dict = t();
  const snapshot = useFinanceStore(s => s.snapshot);
  const update = useFinanceStore(s => s.updateSettings);
  const clearUnknownSms = useFinanceStore(s => s.clearUnknownSms);
  const wipeAllData = useFinanceStore(s => s.wipeAllData);
  const unlockVault = useAuthStore(s => s.unlockVault);

  const clearUnknown = () => {
    Alert.alert(dict.settings.clearUnknownTitle, dict.settings.clearUnknownBody, [
      { text: dict.common.cancel, style: 'cancel' },
      {
        text: dict.common.confirm,
        style: 'destructive',
        onPress: () => {
          clearUnknownSms();
          hapticSuccess();
        },
      },
    ]);
  };

  const exportCsv = async () => {
    const header = 'id,date,type,direction,amountRial,merchant,categoryId,accountId';
    const lines = snapshot.transactions.map(tx =>
      [
        tx.id,
        tx.transactionDate,
        tx.type,
        tx.direction,
        tx.amountRial,
        JSON.stringify(tx.merchant ?? ''),
        tx.categoryId,
        tx.accountId,
      ].join(','),
    );
    await Share.share({
      message: [header, ...lines].join('\n'),
      title: dict.settings.exportCsv,
    });
  };

  return (
    <Shell title={dict.settings.categories.dataManagement}>
      <SettingsSection title={dict.settings.sections.actions}>
        <SettingsNavRow
          title={dict.settings.exportCsv}
          subtitle={`${toPersianDigits(String(snapshot.transactions.length))} ${dict.settings.itemUnit}`}
          onPress={() => void exportCsv()}
        />
        <SettingsNavRow
          title={dict.settings.clearUnknown}
          subtitle={`${toPersianDigits(String(snapshot.unknownSms.length))} ${dict.settings.itemUnit}`}
          onPress={clearUnknown}
        />
        <SettingsNavRow
          title={dict.settings.resetLocks}
          subtitle={dict.settings.resetLocksHint}
          onPress={() => {
            Alert.alert(dict.settings.resetLocksTitle, dict.settings.resetLocksBody, [
              { text: dict.common.cancel, style: 'cancel' },
              {
                text: dict.common.confirm,
                style: 'destructive',
                onPress: () => {
                  // The lock is turned off below either way; a leftover record is unused.
                  clearPinHash().catch(() => undefined);
                  void clearVaultToken();
                  update({ appLockEnabled: false, biometricUnlock: false });
                  unlockVault();
                  hapticSuccess();
                },
              },
            ]);
          }}
        />
        <SettingsNavRow
          title={dict.settings.wipeAllData}
          subtitle={dict.settings.wipeAllDataHint}
          onPress={() => {
            Alert.alert(dict.settings.wipeAllDataTitle, dict.settings.wipeAllDataBody, [
              { text: dict.common.cancel, style: 'cancel' },
              {
                text: dict.common.confirm,
                style: 'destructive',
                onPress: () => {
                  void (async () => {
                    await wipeAllData();
                    unlockVault();
                    update({ appLockEnabled: false, biometricUnlock: false });
                    hapticSuccess();
                    Alert.alert(dict.settings.wipeAllDataDone);
                  })();
                },
              },
            ]);
          }}
          last
        />
      </SettingsSection>
      <AppText style={styles.hint}>{dict.settings.dataDangerHint}</AppText>
    </Shell>
  );
}

export function SettingsAppearanceScreen() {
  const styles = useThemedStyles(createCategoryStyles);
  const dict = t();
  const themePref = useFinanceStore(s => s.snapshot.settings.theme ?? 'dark');
  const accentId = useFinanceStore(s => s.snapshot.settings.accentId ?? 'emerald');
  const reducedMotion = useFinanceStore(s => Boolean(s.snapshot.settings.reducedMotion));
  const moneySound = useFinanceStore(s => s.snapshot.settings.moneySoundEnabled !== false);
  const settings = useSettings();
  const update = useFinanceStore(s => s.updateSettings);
  const { colors, accent } = useAppTheme();

  const setTheme = (id: 'dark' | 'light' | 'system') => {
    if (themePref === id) {
      return;
    }
    // بدون haptic سنگین — لرزش روی بعضی دستگاه‌ها AppState را مختل می‌کند
    update({ theme: id });
  };

  const setAccent = (id: (typeof ACCENT_PRESETS)[number]['id']) => {
    if (accentId === id) {
      return;
    }
    update({ accentId: id });
  };

  return (
    <Shell title={dict.settings.categories.appearance}>
      <SettingsSection title={dict.settings.sections.theme}>
        {(
          [
            ['dark', dict.settings.themeDark],
            ['light', dict.settings.themeLight],
            ['system', dict.settings.themeSystem],
          ] as const
        ).map(([id, label], i, arr) => (
          <SettingsNavRow
            key={id}
            title={label}
            subtitle={themePref === id ? dict.settings.status.active : undefined}
            onPress={() => setTheme(id)}
            last={i === arr.length - 1}
          />
        ))}
      </SettingsSection>

      <SettingsSection title={dict.settings.accentSection}>
        <View style={styles.accentGrid}>
          {ACCENT_PRESETS.map(preset => {
            const selected = accentId === preset.id;
            return (
              <Pressable
                key={preset.id}
                onPress={() => setAccent(preset.id)}
                style={[
                  styles.accentChip,
                  selected && {
                    borderColor: preset.primary,
                    backgroundColor: preset.primaryGlow,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}>
                <View style={[styles.accentDot, { backgroundColor: preset.primary }]} />
                <AppText
                  style={[styles.accentLabel, selected && { color: colors.primary }]}>
                  {dict.settings.accents[preset.id]}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        <AppText style={styles.hint}>
          {dict.settings.accentHint} ·{' '}
          {dict.settings.accents[(accent.id ?? 'emerald') as keyof typeof dict.settings.accents]}
        </AppText>
      </SettingsSection>

      <SettingsSection title={dict.settings.sections.motion}>
        <SettingsToggleRow
          title={dict.moments.moneySound}
          subtitle={dict.moments.moneySoundHint}
          value={moneySound}
          onValueChange={v => update({ moneySoundEnabled: v })}
        />
        <SettingsToggleRow
          title={dict.profile.reducedMotion}
          value={reducedMotion}
          onValueChange={v => update({ reducedMotion: v })}
          last
        />
      </SettingsSection>

      <SettingsSection title={dict.settings.sections.currency}>
        <SettingsToggleRow
          title={dict.settings.displayAsToman}
          subtitle={dict.settings.displayAsTomanHint}
          value={settings.displayCurrency === 'IRT'}
          onValueChange={v => update({ displayCurrency: v ? 'IRT' : 'IRR' })}
        />
        <SettingsNavRow
          title={dict.settings.calendarJalali}
          subtitle={
            settings.calendar === 'jalali'
              ? dict.settings.status.active
              : dict.settings.calendarGregorian
          }
          onPress={() =>
            update({ calendar: settings.calendar === 'jalali' ? 'gregorian' : 'jalali' })
          }
          last
        />
      </SettingsSection>

      <SettingsSection title={dict.settings.sections.month}>
        <AppText style={styles.hint}>{dict.settings.monthStartHint}</AppText>
        <View style={styles.dayRow}>
          {[1, 15, 21].map(d => (
            <Pressable
              key={d}
              onPress={() => update({ financialMonthStartDay: d })}
              style={[
                styles.dayChip,
                settings.financialMonthStartDay === d && styles.dayChipOn,
              ]}>
              <AppText
                style={{
                  color:
                    settings.financialMonthStartDay === d ? colors.primary : colors.text,
                }}>
                {toPersianDigits(String(d))}
              </AppText>
            </Pressable>
          ))}
        </View>
      </SettingsSection>

      <AppText style={styles.hint}>{dict.settings.themePartialHint}</AppText>
    </Shell>
  );
}

export function SettingsLanguageScreen() {
  const styles = useThemedStyles(createCategoryStyles);
  const dict = t();
  const settings = useSettings();
  const update = useFinanceStore(s => s.updateSettings);
  return (
    <Shell title={dict.settings.categories.languageRegion}>
      <SettingsSection title={dict.settings.sections.region}>
        <SettingsNavRow
          title={dict.settings.languageFa}
          subtitle={dict.settings.status.active}
          onPress={() => undefined}
        />
        <SettingsToggleRow
          title={dict.settings.displayAsToman}
          subtitle={dict.settings.displayAsTomanHint}
          value={settings.displayCurrency === 'IRT'}
          onValueChange={v => update({ displayCurrency: v ? 'IRT' : 'IRR' })}
        />
      </SettingsSection>
      <SettingsSection title={dict.settings.calendarSection}>
        <SettingsNavRow
          title={dict.settings.calendarJalali}
          subtitle={settings.calendar === 'jalali' ? dict.settings.status.active : undefined}
          onPress={() => {
            update({ calendar: 'jalali' });
            hapticSuccess();
          }}
        />
        <SettingsNavRow
          title={dict.settings.calendarGregorian}
          subtitle={settings.calendar === 'gregorian' ? dict.settings.status.active : undefined}
          onPress={() => {
            update({ calendar: 'gregorian' });
            hapticSuccess();
          }}
          last
        />
      </SettingsSection>
      <AppText style={styles.hint}>{dict.settings.languageHint}</AppText>
    </Shell>
  );
}

export function SettingsDeveloperScreen() {
  const styles = useThemedStyles(createCategoryStyles);
  const dict = t();
  const navigation = useNavigation<Nav>();
  if (!__DEV__) {
    return (
      <Shell title={dict.settings.categories.developer}>
        <AppText style={styles.hint}>{dict.settings.devHidden}</AppText>
      </Shell>
    );
  }
  return (
    <Shell title={dict.settings.categories.developer}>
      <SettingsSection title={dict.settings.sections.devTools}>
        <SettingsNavRow
          title={dict.settings.openParserLab}
          onPress={() => navigateRoot(navigation, 'SmsParserLab')}
        />
        <SettingsNavRow
          title={dict.settings.openSmsTest}
          onPress={() => navigateRoot(navigation, 'SmsTest')}
          last
        />
      </SettingsSection>
    </Shell>
  );
}

export function SettingsSupportScreen() {
  const styles = useThemedStyles(createCategoryStyles);
  const dict = t();
  const navigation = useNavigation<Nav>();
  const joined = useFinanceStore(s => s.snapshot.settings.proWaitlistJoined);
  const joinProWaitlist = useFinanceStore(s => s.joinProWaitlist);
  return (
    <Shell title={dict.settings.categories.support}>
      <SettingsSection title={dict.settings.sections.help}>
        <SettingsNavRow
          title={joined ? dict.settings.proWaitlistJoined : dict.settings.proWaitlist}
          subtitle={dict.settings.proWaitlistHint}
          onPress={() => {
            if (!joined) {
              joinProWaitlist();
            }
            Alert.alert(dict.settings.proWaitlist, dict.settings.proWaitlistOk);
            void Share.share({
              message: dict.settings.inviteProDraft,
              title: dict.settings.inviteFriend,
            });
          }}
        />
        <SettingsNavRow
          title={dict.settings.inviteFriend}
          onPress={() => {
            void Share.share({
              message: dict.settings.inviteDraft,
              title: dict.settings.inviteFriend,
            });
          }}
        />
        <SettingsNavRow
          title={dict.settings.feedback}
          onPress={() => {
            void Share.share({ message: dict.settings.feedbackDraft, title: dict.settings.feedback });
          }}
        />
        <SettingsNavRow
          title={dict.crash.report}
          subtitle={dict.crash.reportHint}
          onPress={() => {
            const entries = getCrashLog();
            if (entries.length === 0) {
              Alert.alert(dict.crash.report, dict.crash.reportEmpty);
              return;
            }
            void Share.share({
              message: formatCrashReport(entries, APP_VERSION),
              title: dict.crash.reportShareTitle,
            });
          }}
        />
        <SettingsNavRow
          title={dict.settings.privacyPolicy}
          onPress={() => navigateRoot(navigation, 'Privacy')}
        />
        <SettingsNavRow
          title={dict.settings.categories.about}
          onPress={() => navigateRoot(navigation, 'SettingsAbout')}
          last
        />
      </SettingsSection>
      <AppText style={styles.hint}>{dict.settings.supportHonestHint}</AppText>
    </Shell>
  );
}

export function SettingsAboutScreen() {
  const styles = useThemedStyles(createCategoryStyles);
  const dict = t();
  const navigation = useNavigation<Nav>();
  const { colors } = useAppTheme();
  return (
    <Shell title={dict.settings.categories.about}>
      <View style={styles.about}>
        <AppText style={[styles.aboutName, { color: colors.primary }]}>{dict.appName}</AppText>
        <AppText style={styles.aboutMeta}>
          {dict.settings.versionLabel} {toPersianDigits(APP_VERSION)}
        </AppText>
        <AppText style={styles.aboutMeta}>{dict.settings.aboutBody}</AppText>
        <AppText style={[styles.aboutMaker, { color: colors.textSecondary }]}>
          {dict.settings.madeBy}
        </AppText>
      </View>
      <SettingsSection title={dict.settings.sections.help}>
        <SettingsNavRow
          title={dict.settings.categories.support}
          onPress={() => navigateRoot(navigation, 'SettingsSupport')}
        />
        <SettingsNavRow
          title={dict.settings.inviteFriend}
          onPress={() => {
            void Share.share({
              message: dict.settings.inviteDraft,
              title: dict.settings.inviteFriend,
            });
          }}
          last
        />
      </SettingsSection>
    </Shell>
  );
}

