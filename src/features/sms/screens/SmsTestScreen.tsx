import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../components/ui/AppText';
import { GlassCard } from '../../../components/ui/GlassCard';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { interpolate, t } from '../../../i18n';
import { runSmsPipeline } from '../pipeline/run';
import { formatTomanLabel } from '../../../utils/currency/money';
import { toJalaliLabel } from '../../../utils/dates/jalali';
import { useFinanceStore } from '../../../store/finance/store';
import { readFinancialInbox, requestSmsPermission, SMS_INBOX_LIMIT } from '../native/SmsModule';
import { SMS_SAMPLES, type SmsSample } from '../fixtures/samples';
import { HistoricalImportPanel } from '../components/HistoricalImportPanel';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../app/navigation/types';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';

function createSmsTestStyles(c: { background: string; border: string; text: string; surfaceSolid: string }, t: { typography: { fontFamily: { regular: string } } }) {
  return {
    screen: { flex: 1, backgroundColor: c.background },
    sectionLabel: { textAlign: 'right' as const, marginTop: 4 },
    chips: { flexDirection: 'row-reverse' as const, flexWrap: 'wrap' as const, gap: 8 },
    chip: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: c.surfaceSolid,
    },
    row: { flexDirection: 'row-reverse' as const, justifyContent: 'space-between' as const, paddingVertical: 8 },
    sender: {
      minHeight: 44,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      color: c.text,
      paddingHorizontal: 12,
      backgroundColor: c.surfaceSolid,
      fontFamily: t.typography.fontFamily.regular,
      writingDirection: 'ltr' as const,
    },
    input: {
      minHeight: 88,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      color: c.text,
      padding: 12,
      backgroundColor: c.surfaceSolid,
      fontFamily: t.typography.fontFamily.regular,
    },
  };
}

export function SmsTestScreen({
  navigation,
}: {
  navigation: NativeStackNavigationProp<RootStackParamList>;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useThemedStyles(createSmsTestStyles);
  const ingest = useFinanceStore(s => s.ingestSms);
  const update = useFinanceStore(s => s.updateSettings);
  const snapshot = useFinanceStore(s => s.snapshot);
  const dict = t();
  const [sender, setSender] = useState('9830009417');
  const [body, setBody] = useState('');
  const [inboxCount, setInboxCount] = useState<number | null>(null);
  const [scanError, setScanError] = useState(false);

  const preview = useMemo(() => {
    if (!body.trim()) {
      return null;
    }
    return runSmsPipeline({
      userId: snapshot.profile.id,
      accountId: snapshot.accounts[0]?.id ?? 'preview',
      existing: [],
      raw: {
        sender,
        body,
        receivedAt: new Date().toISOString(),
      },
    });
  }, [body, sender, snapshot.accounts, snapshot.profile.id]);

  const applySample = (sample: SmsSample) => {
    setSender(sample.sender);
    setBody(sample.body);
  };

  const injectAllSamples = () => {
    if (!snapshot.settings.smsProcessingEnabled) {
      update({ smsProcessingEnabled: true, selectedBankIds: ['melli', 'mellat', 'saman', 'tejarat', 'pasargad'] });
    }
    let n = 0;
    const base = Date.now();
    SMS_SAMPLES.forEach((sample, i) => {
      const result = useFinanceStore.getState().ingestSms({
        sender: sample.sender,
        body: sample.body,
        receivedAt: new Date(base - i * 60_000).toISOString(),
      });
      if (result.kind !== 'ignored' && result.kind !== 'duplicate') {
        n += 1;
      }
    });
    setInboxCount(n);
    if (n > 0) {
      navigation.navigate('Main');
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + 20, padding: 20, gap: 10, paddingBottom: 40 }}>
      <AppText variant="title" style={{ textAlign: 'center' }}>
        {dict.sms.testTitle}
      </AppText>
      <AppText variant="caption" style={{ textAlign: 'center' }}>
        {dict.sms.pasteHint}
      </AppText>

      <AppText variant="caption" style={styles.sectionLabel}>
        {dict.sms.samplesTitle}
      </AppText>
      <View style={styles.chips}>
        {SMS_SAMPLES.map(sample => (
          <Pressable key={sample.id} onPress={() => applySample(sample)} style={styles.chip}>
            <AppText variant="caption">{sample.label}</AppText>
          </Pressable>
        ))}
      </View>
      <PrimaryButton label={dict.sms.injectAll} onPress={injectAllSamples} />

      <TextInput
        value={sender}
        onChangeText={setSender}
        placeholder={dict.sms.senderField}
        placeholderTextColor={colors.textMuted}
        textAlign="left"
        style={styles.sender}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TextInput
        value={body}
        onChangeText={setBody}
        multiline
        textAlign="right"
        style={styles.input}
        placeholder={dict.sms.bodyField}
        placeholderTextColor={colors.textMuted}
      />
      <GlassCard>
        <Row k={dict.transactions.bank} v={preview?.telemetry.bankId ?? '—'} />
        <Row
          k={dict.transactions.type}
          v={preview?.transaction?.type ?? preview?.status ?? '—'}
        />
        <Row
          k={dict.transactions.amount}
          v={
            preview?.transaction
              ? formatTomanLabel(preview.transaction.amountRial)
              : '—'
          }
        />
        <Row k={dict.transactions.date} v={toJalaliLabel(new Date().toISOString())} />
      </GlassCard>
      <PrimaryButton
        label={dict.sms.confirm}
        onPress={() => {
          ingest({
            sender: sender.trim() || 'test',
            body,
            receivedAt: new Date().toISOString(),
          });
          navigation.navigate('Main');
        }}
      />
      <PrimaryButton label={dict.sms.correct} onPress={() => navigation.navigate('AddTransaction', { mode: 'expense' })} />
      <PrimaryButton
        label={dict.sms.scanInbox}
        onPress={async () => {
          setScanError(false);
          const granted = await requestSmsPermission();
          if (!granted) {
            setScanError(true);
            setInboxCount(null);
            return;
          }
          const rows = await readFinancialInbox(SMS_INBOX_LIMIT);
          let n = 0;
          for (const row of rows) {
            const result = ingest({
              sender: row.sender,
              body: row.body,
              receivedAt: row.receivedAt,
              sourceSmsId: row.sourceSmsId,
            });
            if (result.kind !== 'ignored' && result.kind !== 'duplicate') {
              n += 1;
            }
          }
          update({ smsLastInboxAt: new Date().toISOString() });
          setInboxCount(n);
          if (n > 0) {
            navigation.navigate('Main');
          }
        }}
      />
      <HistoricalImportPanel />
      {__DEV__ ? (
        <Pressable onPress={() => navigation.navigate('SmsParserLab')} style={styles.chip}>
          <AppText variant="caption">{dict.sms.labTitle}</AppText>
        </Pressable>
      ) : null}
      {scanError ? (
        <AppText variant="caption" style={{ textAlign: 'center' }}>
          {dict.sms.scanFail}
        </AppText>
      ) : null}
      {inboxCount != null ? (
        <AppText variant="caption" style={{ textAlign: 'center' }}>
          {interpolate(dict.sms.inboxDone, { count: inboxCount })}
        </AppText>
      ) : null}
      <AppText variant="caption" style={{ textAlign: 'center' }}>
        {dict.sms.fixturesHint}
      </AppText>
      <AppText variant="caption" style={{ textAlign: 'center', color: colors.textMuted }}>
        {dict.sms.adbHint}
      </AppText>
    </ScrollView>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  const styles = useThemedStyles(createSmsTestStyles);
  return (
    <View style={styles.row}>
      <AppText>{v}</AppText>
      <AppText variant="caption">{k}</AppText>
    </View>
  );
}
