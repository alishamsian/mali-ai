import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../components/ui/AppText';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { t } from '../../../i18n';
import { useAuthStore } from '../../../store/auth/store';
import { useFinanceStore } from '../../../store/finance/store';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../app/navigation/types';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';

export function AuthScreen({
  navigation,
}: {
  navigation: NativeStackNavigationProp<RootStackParamList>;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useThemedStyles((c, th) => ({
    screen: { flex: 1, backgroundColor: 'transparent' },
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
  const signIn = useAuthStore(s => s.signInLocal);
  const updateProfile = useFinanceStore(s => s.updateProfile);
  const dict = t();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const go = () => {
    if (name.trim()) {
      updateProfile({ displayName: name.trim(), phone: phone.trim() || undefined });
    }
    signIn();
    navigation.replace('Main');
  };
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 40, padding: 24, gap: 12 }]}>
      <AppText variant="title" style={{ textAlign: 'center' }}>
        {dict.auth.title}
      </AppText>
      <AppText variant="caption" style={{ textAlign: 'center' }}>
        {dict.auth.localHint}
      </AppText>
      <TextInput value={name} onChangeText={setName} placeholder={dict.auth.name} placeholderTextColor={colors.textMuted} textAlign="right" style={styles.input} />
      <TextInput value={phone} onChangeText={setPhone} placeholder={dict.auth.phone} placeholderTextColor={colors.textMuted} textAlign="right" keyboardType="phone-pad" style={styles.input} />
      <PrimaryButton label={dict.auth.continue} onPress={go} />
      <PrimaryButton label={dict.auth.later} onPress={go} />
    </View>
  );
}
