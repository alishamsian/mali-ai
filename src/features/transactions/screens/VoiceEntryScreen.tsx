import React, { useEffect, useMemo } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Mic, Square } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText } from '../../../components/ui/AppText';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { PressScale } from '../../../components/ui/PressScale';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { VoiceWaveform } from '../../../components/voice/VoiceWaveform';
import { useVoiceEntry } from '../../../hooks/useVoiceEntry';
import { parseVoiceTransaction } from '../../../services/voice/voiceParser';
import { t } from '../../../i18n';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { formatTomanFromRial, tomanToRial, displayUnitLabel } from '../../../utils/currency/money';
import type { RootStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'VoiceEntry'>;

/**
 * Say it, check it, save it: speech becomes a draft that opens the regular add screen
 * prefilled, so wallet creation, duplicate checks and undo all still apply.
 */
export function VoiceEntryScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const dict = t().voiceEntry;
  const { state, transcript, start, stop } = useVoiceEntry();
  const draft = useMemo(
    () => (transcript ? parseVoiceTransaction(transcript) : null),
    [transcript],
  );
  const listening = state === 'listening';

  // Start listening as soon as the screen opens: the user came here to speak.
  useEffect(() => {
    void start();
  }, [start]);

  const styles = useThemedStyles((c, th) => ({
    scroll: {
      flexGrow: 1,
      paddingHorizontal: th.spacing.lg,
      paddingTop: insets.top + 8,
      paddingBottom: insets.bottom + 24,
    },
    stage: { alignItems: 'center', gap: 16, marginTop: 24, marginBottom: 24 },
    hint: {
      fontSize: 20,
      textAlign: 'center',
      color: c.text,
      fontFamily: th.typography.fontFamily.semibold,
    },
    sub: { fontSize: 13, textAlign: 'center', color: c.textMuted, lineHeight: 22 },
    mic: {
      width: 96,
      height: 96,
      borderRadius: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    card: { padding: 18, gap: 10 },
    kicker: { textAlign: 'right', color: c.textMuted, fontSize: 12 },
    transcript: { textAlign: 'right', color: c.text, fontSize: 17, lineHeight: 28 },
    row: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
    value: { color: c.text, fontFamily: th.typography.fontFamily.semibold, fontSize: 15 },
    chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
    warn: { textAlign: 'right', color: c.warning, fontSize: 12 },
    spacer: { flex: 1, minHeight: 16 },
    link: { padding: 14, alignItems: 'center' },
    linkText: { color: c.textMuted, fontSize: 13 },
    privacy: {
      textAlign: 'center',
      color: c.textMuted,
      fontSize: 11,
      lineHeight: 18,
      marginTop: 8,
    },
  }));

  const statusText =
    state === 'denied'
      ? dict.denied
      : state === 'unavailable'
      ? dict.unavailable
      : state === 'error'
      ? dict.error
      : listening
      ? dict.listening
      : dict.example;

  const proceed = () => {
    if (!draft) {
      return;
    }
    navigation.replace('AddTransaction', {
      mode: draft.direction === 'in' ? 'income' : 'expense',
      amountToman: draft.amountToman || undefined,
      merchant: draft.merchant || undefined,
      notes: draft.rawText,
    });
  };

  return (
    <NightCanvas>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ScreenHeader title={dict.title} onBack={() => navigation.goBack()} />
        <View style={styles.stage}>
          <AppText style={styles.hint}>{listening ? dict.listening : dict.hint}</AppText>
          <AppText style={styles.sub}>{statusText}</AppText>
          <VoiceWaveform active={listening} />
          <PressScale
            accessibilityRole="button"
            accessibilityLabel={listening ? dict.tapToStop : dict.tapToSpeak}
            disabled={state === 'unavailable'}
            onPress={() => (listening ? stop() : void start())}
            style={[
              styles.mic,
              { backgroundColor: listening ? colors.highlight : colors.primary },
            ]}>
            {listening ? (
              <Square size={28} color={colors.onHighlight} fill={colors.onHighlight} />
            ) : (
              <Mic size={36} color={colors.onPrimary} strokeWidth={1.8} />
            )}
          </PressScale>
          <AppText style={styles.sub}>{listening ? dict.tapToStop : dict.tapToSpeak}</AppText>
        </View>

        {draft ? (
          <GlassPanel strong radius={26} style={styles.card}>
            <AppText style={styles.kicker}>{dict.heard}</AppText>
            <AppText style={styles.transcript}>«{draft.rawText}»</AppText>
            <View style={styles.row}>
              <AppText style={styles.kicker}>{dict.amount}</AppText>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                <View
                  style={[
                    styles.chip,
                    {
                      backgroundColor: draft.direction === 'in' ? colors.income : colors.highlight,
                    },
                  ]}>
                  <AppText
                    style={{
                      fontSize: 12,
                      color: draft.direction === 'in' ? colors.onPrimary : colors.onHighlight,
                    }}>
                    {draft.direction === 'in' ? dict.income : dict.expense}
                  </AppText>
                </View>
                <AppText style={styles.value}>
                  {draft.amountToman
                    ? `${formatTomanFromRial(tomanToRial(draft.amountToman))} ${displayUnitLabel()}`
                    : '—'}
                </AppText>
              </View>
            </View>
            {draft.merchant ? (
              <View style={styles.row}>
                <AppText style={styles.kicker}>{dict.for}</AppText>
                <AppText style={styles.value} numberOfLines={1}>
                  {draft.merchant}
                </AppText>
              </View>
            ) : null}
            {draft.amountToman ? null : <AppText style={styles.warn}>{dict.noAmount}</AppText>}
          </GlassPanel>
        ) : null}

        <View style={styles.spacer} />
        {state === 'denied' ? (
          <Pressable onPress={() => void Linking.openSettings()} style={styles.link}>
            <AppText style={[styles.linkText, { color: colors.text }]}>{dict.openSettings}</AppText>
          </Pressable>
        ) : null}
        {draft && !listening ? (
          <>
            <PrimaryButton label={dict.continue} onPress={proceed} />
            <Pressable onPress={() => void start()} style={styles.link} accessibilityRole="button">
              <AppText style={styles.linkText}>{dict.again}</AppText>
            </Pressable>
          </>
        ) : null}
        <AppText style={styles.privacy}>{dict.privacy}</AppText>
      </ScrollView>
    </NightCanvas>
  );
}
