import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft } from 'lucide-react-native';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { Section } from '../../../components/ui/Section';
import { Surface } from '../../../components/ui/Surface';
import { AppText } from '../../../components/ui/AppText';
import { t } from '../../../i18n';
import { useFinanceStore } from '../../../store/finance/store';
import { isCloudSyncAvailable } from '../../../app/config/features';
import type { RootStackParamList } from '../../../app/navigation/types';
import { navigateRoot } from '../../../app/navigation/navigateRoot';
import { searchSettings, SETTINGS_CATALOG, type SettingsEntry } from '../catalog/settingsCatalog';
import { countEnabledNotificationPrefs, withSettingsDefaults } from '../lib/settingsDefaults';
import { toPersianDigits } from '../../../utils/numbers/digits';
import { toJalaliLabel } from '../../../utils/dates/jalali';
import { accentById } from '../../../theme/accentPresets';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function statusFor(entry: SettingsEntry, ctx: ReturnType<typeof buildStatusCtx>): string | undefined {
  if (!entry.statusKey) {
    return undefined;
  }
  return ctx[entry.statusKey as keyof typeof ctx];
}

function buildStatusCtx(dict: ReturnType<typeof t>, settings: ReturnType<typeof withSettingsDefaults>) {
  const accent = accentById(settings.accentId);
  return {
    smsStatus: settings.smsProcessingEnabled ? dict.settings.status.on : dict.settings.status.off,
    notifStatus: settings.notificationsEnabled
      ? `${toPersianDigits(String(countEnabledNotificationPrefs(settings)))} ${dict.settings.status.enabled}`
      : dict.settings.status.off,
    lockStatus: settings.appLockEnabled ? dict.settings.status.on : dict.settings.status.off,
    themeStatus: `${
      settings.theme === 'light'
        ? dict.settings.themeLight
        : settings.theme === 'system'
          ? dict.settings.themeSystem
          : dict.settings.themeDark
    } · ${dict.settings.accents[accent.id]}`,
  };
}

export function SettingsHomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { colors } = useAppTheme();
  const styles = useThemedStyles((c, th) => ({
    title: {
      textAlign: 'right' as const,
      fontSize: 26,
      fontFamily: th.typography.fontFamily.semibold,
      color: c.text,
    },
    subtitle: {
      textAlign: 'right' as const,
      marginTop: 4,
      marginBottom: 16,
      fontSize: 12,
      color: c.textMuted,
    },
    profile: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 12,
      marginBottom: 14,
    },
    profileBody: { flex: 1, alignItems: 'flex-end' as const },
    profileName: {
      fontSize: 16,
      fontFamily: th.typography.fontFamily.semibold,
      color: c.text,
    },
    profileMeta: { marginTop: 3, fontSize: 11, color: c.textMuted },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: th.palette.primaryGlow,
      borderWidth: 1,
      borderColor: c.primary,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    avatarText: {
      fontSize: 18,
      color: c.primary,
      fontFamily: th.typography.fontFamily.semibold,
    },
    search: {
      minHeight: 46,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 14,
      color: c.text,
      backgroundColor: 'rgba(255,255,255,0.03)',
      marginBottom: 16,
    },
    groupWrap: { marginBottom: 0 },
    row: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      paddingVertical: 14,
      gap: 10,
    },
    rowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    rowBody: { flex: 1, alignItems: 'flex-end' as const },
    rowTitle: {
      fontSize: 14,
      color: c.text,
      fontFamily: th.typography.fontFamily.semibold,
      textAlign: 'right' as const,
    },
    rowSub: { marginTop: 3, fontSize: 11, color: c.textMuted, textAlign: 'right' as const },
    emptySearch: {
      textAlign: 'center' as const,
      padding: 20,
      color: c.textMuted,
    },
  }));
  const snapshot = useFinanceStore(s => s.snapshot);
  const dict = t();
  const [query, setQuery] = useState('');
  const settings = withSettingsDefaults(snapshot.settings);
  const statusCtx = buildStatusCtx(dict, settings);
  const cloud = isCloudSyncAvailable();

  const results = useMemo(() => searchSettings(query), [query]);

  const go = (entry: SettingsEntry) => {
    if (entry.route === 'MainAccounts') {
      navigateRoot(navigation, 'Main', { screen: 'Vault' });
      return;
    }
    if (entry.route === 'MainProfile' || entry.route === 'AccountProfile') {
      navigateRoot(navigation, 'AccountProfile');
      return;
    }
    navigateRoot(navigation, entry.route as keyof RootStackParamList);
  };

  const groups: Array<{ key: string; title: string; ids: string[] }> = [
    // Three cards instead of six one-row cards.
    { key: 'money', title: dict.settings.groups.money, ids: ['banksSms', 'accounts', 'budgets'] },
    { key: 'app', title: dict.settings.groups.appPrefs, ids: ['security', 'notifications', 'appearance'] },
    { key: 'data', title: dict.settings.groups.dataHelp, ids: ['backup', 'about'] },
  ];

  if (__DEV__) {
    groups.push({ key: 'dev', title: dict.settings.groups.dev, ids: ['developer'] });
  }


  const byId = Object.fromEntries(SETTINGS_CATALOG.map(e => [e.id, e]));

  const lastSync =
    settings.lastCloudFlushAt != null
      ? toJalaliLabel(settings.lastCloudFlushAt)
      : cloud
        ? dict.settings.syncNever
        : dict.settings.syncLocalOnly;

  return (
    <NightCanvas>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 10,
          paddingBottom: 120,
          paddingHorizontal: 16,
        }}
        keyboardShouldPersistTaps="handled">
        <AppText style={styles.title}>{dict.settings.title}</AppText>
        <AppText style={styles.subtitle}>{dict.settings.subtitle}</AppText>

        <Surface level="raised" padded style={styles.profile}>
          <Pressable
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
            onPress={() => navigateRoot(navigation, 'AccountProfile')}
            accessibilityRole="button">
            <ChevronLeft color={colors.textMuted} size={18} />
            <View style={styles.profileBody}>
              <AppText style={styles.profileName}>
                {snapshot.profile.displayName || dict.settings.personalAccount}
              </AppText>
              <AppText style={styles.profileMeta}>{dict.settings.personalAccount}</AppText>
              {cloud ? (
                <AppText style={styles.profileMeta}>
                  {dict.settings.lastSync}: {lastSync}
                </AppText>
              ) : (
                <AppText style={styles.profileMeta}>{dict.settings.syncLocalOnly}</AppText>
              )}
            </View>
            <View style={styles.avatar}>
              <AppText style={styles.avatarText}>
                {(snapshot.profile.displayName || 'م').slice(0, 1)}
              </AppText>
            </View>
          </Pressable>
        </Surface>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={dict.settings.search}
          placeholderTextColor={colors.textMuted}
          textAlign="right"
          style={styles.search}
        />

        {query.trim() ? (
          <Surface level="raised" padded>
            {results.length === 0 ? (
              <AppText style={styles.emptySearch}>{dict.settings.noResults}</AppText>
            ) : (
              results.map((entry, i) => (
                <Pressable
                  key={entry.id}
                  onPress={() => go(entry)}
                  style={[styles.row, i < results.length - 1 && styles.rowBorder]}>
                  <ChevronLeft color={colors.textMuted} size={18} />
                  <View style={styles.rowBody}>
                    <AppText style={styles.rowTitle}>
                      {dict.settings.categories[entry.titleKey as keyof typeof dict.settings.categories]}
                    </AppText>
                    {statusFor(entry, statusCtx) ? (
                      <AppText style={styles.rowSub}>{statusFor(entry, statusCtx)}</AppText>
                    ) : null}
                  </View>
                </Pressable>
              ))
            )}
          </Surface>
        ) : (
          groups.map(group => (
            <Section key={group.key} title={group.title} style={styles.groupWrap}>
              <Surface level="raised" padded>
                {group.ids.map((id, i) => {
                  const entry = byId[id];
                  if (!entry) {
                    return null;
                  }
                  const status = statusFor(entry, statusCtx);
                  return (
                    <Pressable
                      key={id}
                      onPress={() => go(entry)}
                      style={[styles.row, i < group.ids.length - 1 && styles.rowBorder]}>
                      <ChevronLeft color={colors.textMuted} size={18} />
                      <View style={styles.rowBody}>
                        <AppText style={styles.rowTitle}>
                          {dict.settings.categories[entry.titleKey as keyof typeof dict.settings.categories]}
                        </AppText>
                        {status ? <AppText style={styles.rowSub}>{status}</AppText> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </Surface>
            </Section>
          ))
        )}
      </ScrollView>
    </NightCanvas>
  );
}
