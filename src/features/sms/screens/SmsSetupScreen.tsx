import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Check,
  Inbox,
  Landmark,
  MessageSquareLock,
  ShieldCheck,
  Sparkles,
} from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText } from '../../../components/ui/AppText';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { PressScale } from '../../../components/ui/PressScale';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { BankEmblem } from '../../../components/banks/BankEmblem';
import { t, interpolate } from '../../../i18n';
import { useFinanceStore } from '../../../store/finance/store';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { toPersianDigits } from '../../../utils/numbers/digits';
import { toJalaliLabel } from '../../../utils/dates/jalali';
import { resolveBankName } from '../../banks/names';
import { requestSmsPermission } from '../native/SmsModule';
import type { DetectedBankSender } from '../setup/detectBanks';
import {
  detectBanksQuickly,
  importBankSms,
  importInBackground,
  initialImportWindow,
} from '../import/historyImport';
import type { RootStackParamList } from '../../../app/navigation/types';

type Phase = 'intro' | 'denied' | 'scanning' | 'pick' | 'none' | 'importing' | 'done';
type Props = NativeStackScreenProps<RootStackParamList, 'SmsSetup'>;

const fa = (n: number) => toPersianDigits(n.toLocaleString('en-US'));

/**
 * First-run SMS setup in one place: permission, automatic bank detection from the
 * inbox, then the whole history of the chosen senders imported with progress.
 */
export function SmsSetupScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const dict = t().smsSetup;
  const [phase, setPhase] = useState<Phase>('intro');
  const [found, setFound] = useState<DetectedBankSender[]>([]);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState({ created: 0, review: 0, banks: 0 });
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  const enterApp = useCallback(() => {
    if (!useFinanceStore.getState().snapshot.settings.onboardingCompleted) {
      useFinanceStore.getState().completeOnboarding();
    }
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  }, [navigation]);

  const scan = useCallback(async () => {
    setPhase('scanning');
    const detected = await detectBanksQuickly();
    if (!alive.current) {
      return;
    }
    setFound(detected);
    setChosen(new Set(detected.map(d => d.sender)));
    setPhase(detected.length > 0 ? 'pick' : 'none');
  }, []);

  const start = useCallback(async () => {
    if (Platform.OS !== 'android') {
      enterApp();
      return;
    }
    const granted = await requestSmsPermission();
    if (!granted) {
      setPhase('denied');
      return;
    }
    await scan();
  }, [enterApp, scan]);

  const importAll = useCallback(async () => {
    const store = useFinanceStore.getState();
    const selected = found.filter(f => chosen.has(f.sender));
    if (selected.length === 0) {
      return;
    }
    setPhase('importing');
    for (const f of selected) {
      store.verifyBankSender({ bankId: f.bankId, sender: f.sender });
    }
    const now = Date.now();
    const senders = selected.map(f => f.sender);
    const { currentFromMs, historyFromMs } = initialImportWindow(new Date(now));
    // This month first, so the user is in within seconds; the two months before it
    // follow in the background (older history is a choice in settings).
    const { created, review, total } = await importBankSms({
      senders,
      fromMs: currentFromMs,
      toMs: now,
      onProgress: (done, all) => setProgress({ done, total: all }),
    });
    void importInBackground({
      senders,
      fromMs: historyFromMs,
      toMs: currentFromMs - 1,
      message: t().smsSetup.fillingHistory,
    });
    const syncEnd = new Date(now).toISOString();
    useFinanceStore.getState().updateSettings({
      lastSuccessfulSmsSyncAt: syncEnd,
      smsLastInboxAt: syncEnd,
      lastHistoricalImportAt: syncEnd,
    });
    setProgress({ done: total, total });
    setSummary({ created, review, banks: new Set(selected.map(f => f.bankId)).size });
    setPhase('done');
  }, [chosen, found]);

  const styles = useThemedStyles((c, th) => ({
    scroll: {
      flexGrow: 1,
      paddingHorizontal: th.spacing.lg,
      paddingTop: insets.top + 32,
      paddingBottom: insets.bottom + 24,
    },
    stage: { alignItems: 'center', gap: 14, marginBottom: 28 },
    badge: {
      width: 84,
      height: 84,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
    },
    kicker: { color: c.textMuted, fontSize: 12, textAlign: 'center' },
    title: {
      fontSize: 24,
      lineHeight: 38,
      textAlign: 'center',
      color: c.text,
      fontFamily: th.typography.fontFamily.bold,
    },
    body: {
      fontSize: 14,
      lineHeight: 24,
      textAlign: 'center',
      color: c.textSecondary,
      maxWidth: 320,
    },
    points: { padding: 18, gap: 14, marginBottom: 24 },
    point: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
    pointText: { flex: 1, textAlign: 'right', color: c.text, fontSize: 14 },
    spacer: { flex: 1 },
    later: { padding: 14, alignItems: 'center' },
    laterText: { color: c.textMuted, fontSize: 13 },
    list: { gap: 10, marginBottom: 16 },
    bankRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, padding: 14 },
    bankMain: { flex: 1, gap: 2 },
    bankName: { textAlign: 'right', color: c.text, fontFamily: th.typography.fontFamily.semibold },
    bankSub: { textAlign: 'right', color: c.textMuted, fontSize: 12 },
    tick: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
    },
    track: {
      height: 8,
      borderRadius: 4,
      backgroundColor: c.glassStrong,
      overflow: 'hidden',
      alignSelf: 'stretch',
    },
    fill: { height: 8, borderRadius: 4, backgroundColor: c.highlight },
    stats: { flexDirection: 'row-reverse', gap: 10, marginBottom: 20 },
    stat: { flex: 1, padding: 14, alignItems: 'center', gap: 4 },
    statValue: { fontSize: 22, color: c.text, fontFamily: th.typography.fontFamily.bold },
    statLabel: { fontSize: 12, color: c.textMuted, textAlign: 'center' },
  }));

  const stage = (Icon: typeof Inbox, title: string, body?: string, kicker?: string) => (
    <View style={styles.stage}>
      <View style={styles.badge}>
        <Icon size={38} strokeWidth={1.6} color={colors.onPrimary} />
      </View>
      {kicker ? <AppText style={styles.kicker}>{kicker}</AppText> : null}
      <AppText style={styles.title}>{title}</AppText>
      {body ? <AppText style={styles.body}>{body}</AppText> : null}
    </View>
  );

  const later = (label: string = dict.later) => (
    <Pressable onPress={enterApp} style={styles.later} accessibilityRole="button">
      <AppText style={styles.laterText}>{label}</AppText>
    </Pressable>
  );

  const progressBar = (share: number) => (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.round(Math.min(1, share) * 100)}%` }]} />
    </View>
  );

  const content = () => {
    switch (phase) {
      case 'intro':
        return (
          <>
            {stage(MessageSquareLock, dict.introTitle, dict.introBody, dict.introKicker)}
            <GlassPanel style={styles.points}>
              {[
                [ShieldCheck, dict.pointLocal],
                [Landmark, dict.pointBanks],
                [Sparkles, dict.pointHistory],
              ].map(([Icon, text]) => {
                const I = Icon as typeof Inbox;
                return (
                  <View key={text as string} style={styles.point}>
                    <I size={20} color={colors.text} strokeWidth={1.7} />
                    <AppText style={styles.pointText}>{text as string}</AppText>
                  </View>
                );
              })}
            </GlassPanel>
            <View style={styles.spacer} />
            <PrimaryButton label={dict.allow} onPress={() => void start()} />
            {later()}
          </>
        );
      case 'denied':
        return (
          <>
            {stage(MessageSquareLock, dict.deniedTitle, dict.deniedBody)}
            <View style={styles.spacer} />
            <PrimaryButton label={dict.retry} onPress={() => void start()} />
            <Pressable onPress={() => void Linking.openSettings()} style={styles.later}>
              <AppText style={[styles.laterText, { color: colors.text }]}>
                {dict.openSettings}
              </AppText>
            </Pressable>
            {later()}
          </>
        );
      case 'scanning':
        return (
          <>
            {stage(Inbox, dict.scanningTitle, dict.scanningBody)}
            {progressBar(0.5)}
          </>
        );
      case 'pick': {
        const total = found
          .filter(f => chosen.has(f.sender))
          .reduce((s, f) => s + f.transactionCount, 0);
        return (
          <>
            {stage(Landmark, dict.pickTitle, dict.pickBody)}
            <View style={styles.list}>
              {found.map(f => {
                const on = chosen.has(f.sender);
                return (
                  <PressScale
                    key={f.sender}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    onPress={() =>
                      setChosen(prev => {
                        const next = new Set(prev);
                        if (on) {
                          next.delete(f.sender);
                        } else {
                          next.add(f.sender);
                        }
                        return next;
                      })
                    }>
                    <GlassPanel radius={22} strong={on} style={styles.bankRow}>
                      <BankEmblem bankId={f.bankId} size={40} />
                      <View style={styles.bankMain}>
                        <AppText style={styles.bankName}>{resolveBankName(f.bankId)}</AppText>
                        <AppText style={styles.bankSub} numberOfLines={1}>
                          {[
                            f.senderDisplay,
                            interpolate(dict.txCount, { n: fa(f.transactionCount) }),
                            interpolate(dict.lastAt, { date: toJalaliLabel(f.lastAt) }),
                          ].join(' · ')}
                        </AppText>
                      </View>
                      <View
                        style={[
                          styles.tick,
                          {
                            borderColor: on ? colors.primary : colors.textMuted,
                            backgroundColor: on ? colors.primary : 'transparent',
                          },
                        ]}>
                        {on ? <Check size={16} color={colors.onPrimary} strokeWidth={2.4} /> : null}
                      </View>
                    </GlassPanel>
                  </PressScale>
                );
              })}
            </View>
            <Pressable onPress={() => navigation.navigate('SmsOnboarding')} style={styles.later}>
              <AppText style={[styles.laterText, { color: colors.text }]}>{dict.notListed}</AppText>
            </Pressable>
            <View style={styles.spacer} />
            <PrimaryButton
              label={`${dict.importCta} (${fa(total)})`}
              disabled={chosen.size === 0}
              onPress={() => void importAll()}
            />
            {later()}
          </>
        );
      }
      case 'none':
        return (
          <>
            {stage(Inbox, dict.noneTitle, dict.noneBody)}
            <View style={styles.spacer} />
            <PrimaryButton
              label={dict.manual}
              onPress={() => navigation.navigate('SmsOnboarding')}
            />
            {later()}
          </>
        );
      case 'importing':
        return (
          <>
            {stage(
              Sparkles,
              dict.importingTitle,
              interpolate(dict.importProgress, {
                done: fa(progress.done),
                total: fa(progress.total),
              }),
            )}
            {progressBar(progress.total > 0 ? progress.done / progress.total : 0.05)}
          </>
        );
      case 'done':
        return (
          <>
            {stage(Check, dict.doneTitle, dict.doneBody)}
            <View style={styles.stats}>
              {[
                [summary.created, dict.doneTx],
                [summary.review, dict.doneReview],
                [summary.banks, dict.doneBanks],
              ].map(([n, label]) => (
                <GlassPanel key={label as string} radius={22} style={styles.stat}>
                  <AppText style={styles.statValue}>{fa(n as number)}</AppText>
                  <AppText style={styles.statLabel}>{label as string}</AppText>
                </GlassPanel>
              ))}
            </View>
            <View style={styles.spacer} />
            <PrimaryButton label={dict.enter} onPress={enterApp} />
          </>
        );
    }
  };

  return (
    <NightCanvas>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {content()}
      </ScrollView>
    </NightCanvas>
  );
}
