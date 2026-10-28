import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../components/ui/AppText';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { BankPickerField } from '../../banks/components/BankPickerField';
import { t } from '../../../i18n';
import { useFinanceStore } from '../../../store/finance/store';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../app/navigation/types';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { withSettingsDefaults } from '../../settings/lib/settingsDefaults';
import { connectionForBank } from '../senders/verified';
import { requestSmsPermission } from '../native/SmsModule';

export function SmsOnboardingScreen({
  navigation,
}: {
  navigation: NativeStackNavigationProp<RootStackParamList>;
}) {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles((c, _th) => ({
    screen: { flex: 1, backgroundColor: 'transparent' },
    body: { textAlign: 'right' as const, marginTop: 12, lineHeight: 24 },
    card: {
      marginTop: 16,
      padding: 18,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surfaceSolid,
      gap: 10,
    },
  }));
  const snapshot = useFinanceStore(s => s.snapshot);
  const update = useFinanceStore(s => s.updateSettings);
  const settings = withSettingsDefaults(snapshot.settings);
  const [selected, setSelected] = useState<string | null>(null);
  const dict = t();

  const verifiedByBankId = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    for (const conn of settings.bankConnections ?? []) {
      const sender = conn.verifiedSenders?.[0]?.sender;
      if (sender) {
        map[conn.bankId] = `${dict.sms.verifiedSenderLabel}: ${sender}`;
      }
    }
    return map;
  }, [dict.sms.verifiedSenderLabel, settings.bankConnections]);

  const onContinue = async () => {
    if (!selected) {
      return;
    }
    await requestSmsPermission();
    update({ smsProcessingEnabled: true });
    const conn = connectionForBank(settings, selected);
    if (conn && conn.verifiedSenders.length > 0) {
      navigation.navigate('BankSendersManage', { bankId: selected });
      return;
    }
    navigation.navigate('SmsSenderPicker', { bankId: selected });
  };

  return (
    <ScrollView
      style={[styles.screen, { paddingTop: insets.top + 24 }]}
      contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 32 }}>
      <AppText variant="title" style={{ textAlign: 'center' }}>
        {dict.sms.title}
      </AppText>
      <AppText variant="body" style={styles.body}>
        {dict.sms.subtitle}
      </AppText>
      <AppText variant="caption" style={styles.body}>
        {dict.sms.verifiedSenderPrivacy}
      </AppText>

      <View style={styles.card}>
        <AppText variant="label" style={{ textAlign: 'right' }}>
          {dict.onboarding.banksTitle}
        </AppText>
        <AppText variant="caption" style={{ textAlign: 'right' }}>
          {dict.sms.connectBankHint}
        </AppText>
        <BankPickerField
          selectedId={selected}
          onSelect={setSelected}
          verifiedByBankId={verifiedByBankId}
          searchPlaceholder={dict.sms.searchBank}
        />
      </View>

      <View style={{ marginTop: 28, gap: 12 }}>
        <PrimaryButton
          label={selected ? dict.sms.pickBankSmsCta : dict.onboarding.continue}
          onPress={() => void onContinue()}
          disabled={!selected}
        />
        <Pressable
          onPress={() => {
            update({ smsProcessingEnabled: false });
            navigation.navigate('Main');
          }}
          style={{ padding: 12 }}>
          <AppText variant="caption" style={{ textAlign: 'center' }}>
            {dict.onboarding.skip}
          </AppText>
        </Pressable>
      </View>
    </ScrollView>
  );
}
