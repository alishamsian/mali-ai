import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { AppText } from '../../../components/ui/AppText';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { GlassCard } from '../../../components/ui/GlassCard';
import { t } from '../../../i18n';
import type { RootStackParamList } from '../../../app/navigation/types';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { useFinanceStore } from '../../../store/finance/store';
import { connectionForBank } from '../senders/verified';
import { withSettingsDefaults } from '../../settings/lib/settingsDefaults';
import { resolveBankName } from '../../banks/names';

export function BankSendersManageScreen({
  navigation,
  route,
}: {
  navigation: NativeStackNavigationProp<RootStackParamList, 'BankSendersManage'>;
  route: RouteProp<RootStackParamList, 'BankSendersManage'>;
}) {
  const { bankId } = route.params;
  const insets = useSafeAreaInsets();
  const dict = t();
  const bankName = resolveBankName(bankId);
  const snapshot = useFinanceStore(s => s.snapshot);
  const remove = useFinanceStore(s => s.removeBankSender);
  const settings = withSettingsDefaults(snapshot.settings);
  const conn = connectionForBank(settings, bankId);
  const [tick, setTick] = useState(0);

  const styles = useThemedStyles(c => ({
    screen: {
      flex: 1,
      backgroundColor: 'transparent',
      paddingTop: insets.top + 16,
      paddingHorizontal: 20,
    },
    row: {
      flexDirection: 'row-reverse' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
  }));

  const onRemove = (sender: string) => {
    const isLast = (conn?.verifiedSenders.length ?? 0) <= 1;
    Alert.alert(
      dict.sms.removeSenderTitle,
      isLast ? dict.sms.removeLastSenderBody : dict.sms.removeSenderBody,
      [
        { text: dict.common.cancel, style: 'cancel' },
        {
          text: dict.common.delete,
          style: 'destructive',
          onPress: () => {
            remove(bankId, sender);
            setTick(x => x + 1);
          },
        },
      ],
    );
  };

  void tick;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
      <AppText variant="title" style={{ textAlign: 'right' }}>
        {bankName}
      </AppText>
      <AppText variant="caption" style={{ textAlign: 'right', marginTop: 8, marginBottom: 16 }}>
        {dict.sms.verifiedSendersSection}
      </AppText>

      <GlassCard>
        {(conn?.verifiedSenders ?? []).length === 0 ? (
          <AppText style={{ textAlign: 'center' }}>{dict.sms.noVerifiedSenders}</AppText>
        ) : (
          conn!.verifiedSenders.map(vs => (
            <View key={vs.sender} style={styles.row}>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <AppText variant="label">{vs.sender}</AppText>
                <AppText variant="caption">
                  {vs.method === 'legacy_system'
                    ? dict.sms.legacySenderBadge
                    : dict.sms.userVerifiedBadge}
                </AppText>
              </View>
              <Pressable onPress={() => onRemove(vs.sender)} style={{ padding: 8 }}>
                <AppText variant="caption">{dict.common.delete}</AppText>
              </Pressable>
            </View>
          ))
        )}
      </GlassCard>

      <View style={{ marginTop: 20 }}>
        <PrimaryButton
          label={dict.sms.addAnotherSender}
          onPress={() => navigation.navigate('SmsSenderPicker', { bankId })}
        />
      </View>
    </ScrollView>
  );
}
