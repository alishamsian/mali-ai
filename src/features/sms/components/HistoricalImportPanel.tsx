import React, { useRef, useState } from 'react';
import { Pressable } from 'react-native';
import { AppText } from '../../../components/ui/AppText';
import { GlassCard } from '../../../components/ui/GlassCard';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { interpolate, t } from '../../../i18n';
import { useFinanceStore } from '../../../store/finance/store';
import { requestSmsPermission } from '../native/SmsModule';
import { runHistoricalSmsImport, type HistoricalImportProgress } from '../import/historicalImport';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { getVerifiedSenderStrings } from '../senders/verified';
import { withSettingsDefaults } from '../../settings/lib/settingsDefaults';

export function HistoricalImportPanel() {
  const dict = t();
  const styles = useThemedStyles(c => ({
    cancel: {
      marginTop: 10,
      minHeight: 44,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
    },
  }));
  const update = useFinanceStore(s => s.updateSettings);
  const [progress, setProgress] = useState<HistoricalImportProgress | null>(null);
  const cancelRef = useRef(false);

  const start = async (forceFull: boolean) => {
    cancelRef.current = false;
    const granted = await requestSmsPermission();
    if (!granted) {
      setProgress({
        phase: 'error',
        percent: 0,
        scanned: 0,
        total: 0,
        bankHits: 0,
        transactions: 0,
        duplicates: 0,
        unknown: 0,
        message: dict.sms.historyPermission,
      });
      return;
    }
    const settings = withSettingsDefaults(useFinanceStore.getState().snapshot.settings);
    if (!settings.smsProcessingEnabled) {
      update({ smsProcessingEnabled: true });
    }
    const verifiedSenders = getVerifiedSenderStrings(settings);
    if (verifiedSenders.length === 0) {
      setProgress({
        phase: 'error',
        percent: 0,
        scanned: 0,
        total: 0,
        bankHits: 0,
        transactions: 0,
        duplicates: 0,
        unknown: 0,
        message: 'ابتدا سرشماره بانک را تأیید کنید',
      });
      return;
    }
    useFinanceStore.getState().beginSmsBatch();
    let result: Awaited<ReturnType<typeof runHistoricalSmsImport>>;
    try {
      result = await runHistoricalSmsImport({
        options: {
          forceFull,
          afterTimestampMs: forceFull ? undefined : settings.lastImportedTimestamp,
        },
        verifiedSenders,
        ingest: payload => useFinanceStore.getState().ingestSms(payload, { mode: 'incremental' }),
        onProgress: setProgress,
        isCancelled: () => cancelRef.current,
      });
    } finally {
      useFinanceStore.getState().endSmsBatch();
    }
    if (result.phase === 'done') {
      const syncEndIso = new Date().toISOString();
      update({
        lastHistoricalImportAt: syncEndIso,
        lastImportedSmsId: result.lastImportedSmsId,
        lastImportedTimestamp: result.lastImportedTimestamp,
        smsLastInboxAt: syncEndIso,
        lastSuccessfulSmsSyncAt: syncEndIso,
        lastSuccessfulSmsSyncSmsDate: result.lastImportedTimestamp,
        lastSuccessfulSmsSyncSmsId: result.lastImportedSmsId,
      });
    }
  };

  return (
    <>
      <PrimaryButton label={dict.sms.historyScan} onPress={() => void start(true)} />
      <PrimaryButton label={dict.sms.historyIncremental} onPress={() => void start(false)} />
      {progress ? (
        <GlassCard>
          <AppText style={{ textAlign: 'center' }}>{progress.message}</AppText>
          <AppText variant="hero" style={{ textAlign: 'center', marginVertical: 8 }}>
            {progress.percent}٪
          </AppText>
          <AppText variant="caption" style={{ textAlign: 'right' }}>
            {interpolate(dict.sms.historyScanned, {
              scanned: progress.scanned,
              total: progress.total,
            })}
          </AppText>
          {progress.phase === 'done' || progress.phase === 'cancelled' ? (
            <>
              <AppText variant="caption" style={{ textAlign: 'right' }}>
                {interpolate(dict.sms.historyBank, { count: progress.bankHits })}
              </AppText>
              <AppText variant="caption" style={{ textAlign: 'right' }}>
                {interpolate(dict.sms.historyTx, { count: progress.transactions })}
              </AppText>
              <AppText variant="caption" style={{ textAlign: 'right' }}>
                {interpolate(dict.sms.historyDup, { count: progress.duplicates })}
              </AppText>
              <AppText variant="caption" style={{ textAlign: 'right' }}>
                {interpolate(dict.sms.historyUnknown, { count: progress.unknown })}
              </AppText>
            </>
          ) : progress.phase === 'scanning' || progress.phase === 'counting' ? (
            <Pressable
              onPress={() => {
                cancelRef.current = true;
              }}
              style={styles.cancel}>
              <AppText>{dict.common.cancel}</AppText>
            </Pressable>
          ) : null}
        </GlassCard>
      ) : null}
    </>
  );
}
