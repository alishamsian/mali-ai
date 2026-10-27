import React, { useState } from 'react';
import { Pressable, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../components/ui/AppText';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { t } from '../../../i18n';
import { useFinanceStore } from '../../../store/finance/store';
import { useAuthStore } from '../../../store/auth/store';
import { isCloudSyncAvailable } from '../../../app/config/features';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../app/navigation/types';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';

/**
 * Account profile only — security / prefs live in Control Center screens.
 * Do not re-add lock/notification toggles here (single source of truth).
 */
export function ProfileScreen({
  navigation,
}: {
  navigation: NativeStackNavigationProp<RootStackParamList>;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useThemedStyles((c, th) => ({
    screen: { flex: 1, backgroundColor: 'transparent' },
    link: {
      minHeight: 52,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      justifyContent: 'center' as const,
      paddingHorizontal: 16,
      backgroundColor: c.surfaceSolid,
    },
    input: {
      minHeight: 52,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      color: c.text,
      paddingHorizontal: 16,
      backgroundColor: c.surfaceSolid,
      fontFamily: th.typography.fontFamily.regular,
    },
  }));
  const snapshot = useFinanceStore(s => s.snapshot);
  const updateProfile = useFinanceStore(s => s.updateProfile);
  const flushCloud = useFinanceStore(s => s.flushCloud);
  const signOut = useAuthStore(s => s.signOut);
  const [name, setName] = useState(snapshot.profile.displayName);
  const dict = t();
  const cloud = isCloudSyncAvailable();

  return (
    <NightCanvas>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          padding: 20,
          gap: 12,
          paddingBottom: 128,
        }}
        keyboardShouldPersistTaps="handled">
        <AppText variant="title" style={{ textAlign: 'center' }}>
          {dict.profile.title}
        </AppText>
        <AppText variant="caption" style={{ textAlign: 'center' }}>
          {dict.settings.personalAccount}
        </AppText>
        <TextInput
          value={name}
          onChangeText={setName}
          onEndEditing={() =>
            updateProfile({ displayName: name.trim() || snapshot.profile.displayName })
          }
          placeholder={dict.profile.displayName}
          placeholderTextColor={colors.textMuted}
          textAlign="right"
          style={styles.input}
          accessibilityLabel={dict.profile.displayName}
        />
        {cloud ? (
          <>
            <AppText variant="caption">{dict.profile.cloudOn}</AppText>
            <PrimaryButton label={dict.profile.cloudSync} onPress={() => void flushCloud()} />
          </>
        ) : null}

        <Pressable onPress={() => navigation.navigate('SettingsSecurity')} style={styles.link}>
          <AppText>{dict.settings.categories.security}</AppText>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('SettingsNotifications')} style={styles.link}>
          <AppText>{dict.settings.categories.notifications}</AppText>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Privacy')} style={styles.link}>
          <AppText>{dict.profile.privacy}</AppText>
        </Pressable>
        <Pressable onPress={() => navigation.goBack()} style={styles.link}>
          <AppText>{dict.profile.openControlCenter}</AppText>
        </Pressable>
        <Pressable
          onPress={() => {
            signOut();
            navigation.navigate('Auth');
          }}
          style={styles.link}>
          <AppText>{dict.profile.signOut}</AppText>
        </Pressable>
      </ScrollView>
    </NightCanvas>
  );
}
