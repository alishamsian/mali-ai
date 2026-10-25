import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../components/ui/AppText';
import { GlassCard } from '../../../components/ui/GlassCard';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { t } from '../../../i18n';
import { useFinanceStore } from '../../../store/finance/store';
import { HistoricalImportPanel } from '../components/HistoricalImportPanel';
import { preprocessSms } from '../normalizer/preprocess';
import { detectBank } from '../detectors/bankDetector';
import { runSmsPipeline } from '../pipeline/run';
import { sanitizeSmsText } from '../privacy/sanitize';
import { scanForSensitiveData } from '../privacy/scanner';
import { formatTomanLabel } from '../../../utils/currency/money';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../app/navigation/types';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';

function createLabStyles(c: { border: string; text: string; surfaceSolid: string }, t: { typography: { fontFamily: { regular: string } } }) {
  return {
    input: {
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      color: c.text,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: c.surfaceSolid,
      fontFamily: t.typography.fontFamily.regular,
    },
    row: {
      flexDirection: 'row-reverse' as const,
      justifyContent: 'space-between' as const,
      paddingVertical: 6,
      gap: 8,
    },
    link: {
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: c.surfaceSolid,
    },
  };
}

/**
 * Developer SMS Parser Lab (paste / sanitize / debug).
 * Historical 30-day import also available via HistoricalImportPanel.
 */
export function SmsParserLabScreen({
  navigation,
}: {
  navigation: NativeStackNavigationProp<RootStackParamList>;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useThemedStyles(createLabStyles);
  const ingest = useFinanceStore(s => s.ingestSms);
  const snapshot = useFinanceStore(s => s.snapshot);
  const dict = t();
  const [raw, setRaw] = useState('');
  const [sender, setSender] = useState('9830009417');

  const sanitized = useMemo(() => sanitizeSmsText(raw), [raw]);
  const privacy = useMemo(() => scanForSensitiveData(sanitized.sanitized), [sanitized.sanitized]);
  const debug = useMemo(() => {
    if (!sanitized.sanitized.trim()) {
      return null;
    }
    const normalized = preprocessSms({
      sender,
      body: sanitized.sanitized,
      receivedAt: new Date().toISOString(),
    });
    const bank = detectBank(normalized);
    const parsed = runSmsPipeline({
      userId: snapshot.profile.id,
      accountId: snapshot.accounts[0]?.id ?? 'lab',
      existing: [],
      raw: { sender, body: sanitized.sanitized, receivedAt: normalized.receivedAt },
    });
    return { normalized, bank, parsed };
  }, [sanitized.sanitized, sender, snapshot.accounts, snapshot.profile.id]);

  return (
    <NightCanvas>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: 48,
          paddingHorizontal: 20,
          gap: 12,
        }}>
        <AppText variant="title" style={{ textAlign: 'center' }}>
          {dict.sms.labTitle}
        </AppText>
        <AppText variant="caption" style={{ textAlign: 'center' }}>
          {dict.sms.labHint}
        </AppText>

        <HistoricalImportPanel />

        <AppText variant="label" style={{ textAlign: 'right' }}>
          {dict.sms.labPaste}
        </AppText>
        <TextInput
          value={sender}
          onChangeText={setSender}
          placeholder={dict.sms.senderField}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          textAlign="left"
        />
        <TextInput
          value={raw}
          onChangeText={setRaw}
          multiline
          placeholder={dict.sms.bodyField}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { minHeight: 120 }]}
          textAlign="right"
        />
        <AppText variant="caption" style={{ textAlign: 'right' }}>
          Sanitize → {sanitized.redactions.join(', ') || '—'}
        </AppText>
        {!privacy.ok ? (
          <AppText style={{ color: colors.expense, textAlign: 'right' }}>
            {dict.sms.privacyBlock}: {privacy.hits.join(', ')}
          </AppText>
        ) : null}

        {debug ? (
          <GlassCard>
            <Row
              k="BankDetector"
              v={`${debug.bank.bankId ?? '—'} (${Math.round((debug.bank.confidence ?? 0) * 100)}٪)`}
            />
            <Row k="conflict" v={debug.bank.conflict ? 'PARSER_CONFLICT' : '—'} />
            <Row k="status" v={debug.parsed.status} />
            <Row k="type" v={debug.parsed.transaction?.type ?? '—'} />
            <Row
              k="amount"
              v={
                debug.parsed.transaction
                  ? formatTomanLabel(debug.parsed.transaction.amountRial)
                  : '—'
              }
            />
            <Row k="card" v={debug.parsed.transaction?.cardLast4 ?? '—'} />
            <Row
              k="balance"
              v={
                debug.parsed.transaction?.balanceAfterRial != null
                  ? formatTomanLabel(debug.parsed.transaction.balanceAfterRial)
                  : '—'
              }
            />
            <Row k="reason" v={debug.parsed.telemetry.failureReason ?? '—'} />
          </GlassCard>
        ) : null}

        <PrimaryButton
          label={dict.sms.confirm}
          onPress={() => {
            if (!privacy.ok) {
              return;
            }
            ingest({
              sender,
              body: sanitized.sanitized,
              receivedAt: new Date().toISOString(),
            });
            navigation.navigate('Main');
          }}
        />
        <Pressable onPress={() => navigation.navigate('ReviewInbox')} style={styles.link}>
          <AppText>{dict.sms.reviewTitle}</AppText>
        </Pressable>
      </ScrollView>
    </NightCanvas>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  const styles = useThemedStyles(createLabStyles);
  return (
    <View style={styles.row}>
      <AppText style={{ flex: 1, textAlign: 'left' }}>{v}</AppText>
      <AppText variant="caption">{k}</AppText>
    </View>
  );
}
