import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
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
import { isSuitableForSenderVerification } from '../senders/classify';
import { normalizeSmsSender } from '../senders/normalize';
import { getVerifiedSenderStrings } from '../senders/verified';
import { collectBankSenderSms } from '../import/bankSenderScan';
import { historicalWindowMs } from '../import/historicalImport';
import { resolveBankName } from '../../banks/names';

export function SmsSenderConfirmScreen({
  navigation,
  route,
}: {
  navigation: NativeStackNavigationProp<RootStackParamList, 'SmsSenderConfirm'>;
  route: RouteProp<RootStackParamList, 'SmsSenderConfirm'>;
}) {
  const { bankId, sender, previewBody, body, startScanAfter } = route.params;
  const insets = useSafeAreaInsets();
  const dict = t();
  const bankName = resolveBankName(bankId);
  const verify = useFinanceStore(s => s.verifyBankSender);
  const ingestSms = useFinanceStore(s => s.ingestSms);
  const update = useFinanceStore(s => s.updateSettings);
  const [busy, setBusy] = useState(false);
  const [unsuitable, setUnsuitable] = useState(false);
  const [done, setDone] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  const styles = useThemedStyles(c => ({
    screen: {
      flex: 1,
      backgroundColor: 'transparent',
      paddingTop: insets.top + 16,
      paddingHorizontal: 20,
    },
    senderBox: {
      marginTop: 20,
      padding: 18,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.primary,
      backgroundColor: c.surfaceSolid,
      alignItems: 'center' as const,
      gap: 8,
    },
  }));

  const onConfirm = async () => {
    if (!isSuitableForSenderVerification(body)) {
      setUnsuitable(true);
      return;
    }
    setBusy(true);
    try {
      verify({ bankId, sender: normalizeSmsSender(sender), method: 'user_selected_sms' });
      setDone(true);
      if (startScanAfter !== false) {
        setScanMsg(dict.sms.scanningVerifiedSender);
        const { minDateMs, maxDateMs } = historicalWindowMs();
        const senders = [normalizeSmsSender(sender)];
        const { rows } = await collectBankSenderSms({
          minDateMs,
          maxDateMs,
          senders,
        });
        useFinanceStore.getState().beginSmsBatch();
        let created = 0;
        try {
          for (let i = 0; i < rows.length; i += 1) {
            const row = rows[i]!;
            const r = ingestSms(
              {
                sender: row.sender,
                body: row.body,
                receivedAt: row.receivedAt,
                sourceSmsId: row.sourceSmsId,
              },
              { mode: 'incremental' },
            );
            if (r.kind === 'created' || r.kind === 'review' || r.kind === 'pending') {
              created += 1;
            }
            if (i > 0 && i % 75 === 0) {
              await new Promise<void>(resolve => setTimeout(resolve, 0));
            }
          }
        } finally {
          useFinanceStore.getState().endSmsBatch();
        }
        const syncEnd = new Date().toISOString();
        update({
          lastSuccessfulSmsSyncAt: syncEnd,
          smsLastInboxAt: syncEnd,
          lastHistoricalImportAt: syncEnd,
        });
        const settings = useFinanceStore.getState().snapshot.settings;
        void import('../native/SmsModule').then(m =>
          m.syncVerifiedSendersToNative(getVerifiedSenderStrings(settings)),
        );
        setScanMsg(
          dict.sms.senderConnectedScanDone
            .replace('{{count}}', String(created))
            .replace('{{scanned}}', String(rows.length)),
        );
      }
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <AppText variant="title" style={{ textAlign: 'center' }}>
          {dict.sms.bankConnectedTitle.replace('{{bank}}', bankName)}
        </AppText>
        <View style={styles.senderBox}>
          <AppText variant="caption">{dict.sms.verifiedSenderLabel}</AppText>
          <AppText variant="hero">{normalizeSmsSender(sender)}</AppText>
        </View>
        <AppText variant="body" style={{ textAlign: 'center', marginTop: 16, lineHeight: 24 }}>
          {dict.sms.bankConnectedBody}
        </AppText>
        {scanMsg ? (
          <AppText variant="caption" style={{ textAlign: 'center', marginTop: 12 }}>
            {scanMsg}
          </AppText>
        ) : null}
        <View style={{ marginTop: 28, gap: 12 }}>
          <PrimaryButton
            label={dict.sms.goToTransactions}
            onPress={() => navigation.navigate('Transactions')}
          />
          <Pressable onPress={() => navigation.navigate('Main')}>
            <AppText variant="caption" style={{ textAlign: 'center' }}>
              {dict.common.done}
            </AppText>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
      <AppText variant="title" style={{ textAlign: 'right' }}>
        {dict.sms.confirmSenderTitle.replace('{{bank}}', bankName)}
      </AppText>
      <View style={styles.senderBox}>
        <AppText variant="caption">{dict.sms.senderFromMessage}</AppText>
        <AppText variant="hero">{normalizeSmsSender(sender)}</AppText>
      </View>
      <GlassCard>
        <AppText variant="caption" style={{ textAlign: 'right', marginBottom: 8 }}>
          {dict.sms.messagePreview}
        </AppText>
        <AppText style={{ textAlign: 'right', lineHeight: 22 }}>{previewBody}</AppText>
      </GlassCard>

      {unsuitable ? (
        <AppText style={{ textAlign: 'center', marginTop: 16, color: '#c45' }}>
          {dict.sms.unsuitableSmsHint}
        </AppText>
      ) : (
        <AppText variant="body" style={{ textAlign: 'right', marginTop: 16, lineHeight: 24 }}>
          {dict.sms.confirmSenderBody.replace('{{bank}}', bankName)}
        </AppText>
      )}

      <View style={{ marginTop: 28, gap: 12 }}>
        <PrimaryButton
          label={busy ? dict.sms.syncUpdating : dict.sms.confirmSenderCta}
          onPress={() => void onConfirm()}
          disabled={busy}
        />
        <Pressable
          onPress={() => navigation.navigate('SmsSenderPicker', { bankId })}
          disabled={busy}>
          <AppText variant="caption" style={{ textAlign: 'center' }}>
            {dict.sms.pickAnotherSms}
          </AppText>
        </Pressable>
      </View>
    </ScrollView>
  );
}
