import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { AppText } from '../../../components/ui/AppText';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { PressScale } from '../../../components/ui/PressScale';
import { interpolate, t } from '../../../i18n';
import { useFinanceStore } from '../../../store/finance/store';
import { hapticTap } from '../../../utils/haptics';
import { toPersianDigits } from '../../../utils/numbers/digits';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../app/navigation/types';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { ONBOARDING_IMAGES, ONBOARDING_SLIDES } from '../config';
import { OnboardingIllustration } from '../components/OnboardingIllustration';

export function OnboardingScreen({
  navigation,
}: {
  navigation: NativeStackNavigationProp<RootStackParamList>;
}) {
  const insets = useSafeAreaInsets();
  const complete = useFinanceStore(s => s.completeOnboarding);
  const { colors, mode } = useAppTheme();
  const glass = mode === 'light';
  const [index, setIndex] = useState(0);
  const dict = t();
  const last = index === ONBOARDING_SLIDES.length - 1;
  const slide = ONBOARDING_SLIDES[index];
  // Slide accents are tuned for dark; on daylight glass, text and progress use ink instead.
  const accentInk = glass ? colors.text : slide.accent;

  const styles = useThemedStyles((c, theme) => ({
    screen: { flex: 1 },
    top: {
      flexDirection: 'row-reverse' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      paddingHorizontal: 24,
      marginBottom: 8,
    },
    brandTile: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: c.primary,
    },
    brandGlyph: {
      fontSize: 24,
      lineHeight: 34,
      fontFamily: theme.typography.fontFamily.bold,
      color: c.onPrimary,
    },
    stepBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.glassBorder,
      backgroundColor: c.glassStrong,
    },
    stepText: { fontSize: 12, color: c.textSecondary },
    progressTrack: {
      height: 4,
      borderRadius: 4,
      backgroundColor: theme.mode === 'light' ? 'rgba(17,19,22,0.1)' : 'rgba(255,255,255,0.08)',
      marginHorizontal: 24,
      marginBottom: 20,
      overflow: 'hidden' as const,
    },
    progressFill: {
      height: 4,
      borderRadius: 4,
    },
    body: {
      flex: 1,
      paddingHorizontal: 28,
    },
    kicker: {
      textAlign: 'center' as const,
      color: accentInk,
      marginBottom: 10,
      fontFamily: theme.typography.fontFamily.semibold,
    },
    title: {
      textAlign: 'center' as const,
      fontSize: 30,
      lineHeight: 42,
      color: c.text,
    },
    copy: {
      textAlign: 'center' as const,
      color: c.textSecondary,
      marginTop: 12,
      lineHeight: 28,
      paddingHorizontal: 4,
    },
    trust: { marginTop: 18, gap: 10 },
    trustRow: {
      flexDirection: 'row-reverse' as const,
      alignItems: 'center' as const,
      gap: 10,
      justifyContent: 'flex-start' as const,
    },
    trustDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: slide.accent,
    },
    trustLine: { textAlign: 'right' as const, color: c.textMuted, lineHeight: 22, flexShrink: 1 },
    footer: { paddingHorizontal: 24, paddingBottom: 8, gap: 10 },
    skip: { paddingVertical: 10, alignItems: 'center' as const },
    backBtn: {
      flexDirection: 'row-reverse' as const,
      alignItems: 'center' as const,
      gap: 4,
      paddingVertical: 8,
      alignSelf: 'flex-start' as const,
      marginBottom: 4,
    },
    illustrationGap: { marginBottom: 32 },
  }));

  const progressPct = ((index + 1) / ONBOARDING_SLIDES.length) * 100;

  const goTo = (next: number) => {
    setIndex(next);
    hapticTap();
  };

  const onPrimary = () => {
    if (!last) {
      goTo(index + 1);
      return;
    }
    // Onboarding completes when the SMS setup is left, so nothing (e.g. the notification
    // prompt) interrupts the setup, and a restart midway starts the setup again.
    navigation.replace('SmsSetup');
  };

  return (
    <NightCanvas>
      <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
        <View style={styles.top}>
          <View style={styles.stepBadge}>
            <AppText style={styles.stepText}>
              {interpolate(dict.onboarding.stepOf, {
                current: toPersianDigits(index + 1),
                total: toPersianDigits(ONBOARDING_SLIDES.length),
              })}
            </AppText>
          </View>
          <View style={styles.brandTile} accessibilityLabel={dict.appName}>
            <AppText style={styles.brandGlyph}>پ</AppText>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${progressPct}%`, backgroundColor: accentInk },
            ]}
          />
        </View>

        <View style={styles.body}>
          <View style={styles.illustrationGap}>
            <OnboardingIllustration
              key={slide.id}
              slide={slide}
              imageSource={ONBOARDING_IMAGES[slide.id]}
              active
            />
          </View>
          <Animated.View key={`copy-${slide.id}`} entering={FadeInUp.duration(360)}>
            {slide.kickerKey ? (
              <AppText variant="kicker" style={styles.kicker}>
                {dict.onboarding[slide.kickerKey]}
              </AppText>
            ) : null}
            <AppText variant="title" style={styles.title}>
              {dict.onboarding[slide.titleKey]}
            </AppText>
            <AppText variant="body" style={styles.copy}>
              {dict.onboarding[slide.bodyKey]}
            </AppText>
            {last ? (
              <View style={styles.trust}>
                {[dict.onboarding.trust1, dict.onboarding.trust2, dict.onboarding.trust3].map(line => (
                  <View key={line} style={styles.trustRow}>
                    <View style={styles.trustDot} />
                    <AppText variant="caption" style={styles.trustLine}>
                      {line}
                    </AppText>
                  </View>
                ))}
              </View>
            ) : null}
          </Animated.View>
        </View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          {index > 0 ? (
            <PressScale onPress={() => goTo(index - 1)} style={styles.backBtn}>
              <ChevronLeft color={colors.textSecondary} size={18} />
              <AppText variant="caption" style={{ color: colors.textSecondary }}>
                {dict.onboarding.back}
              </AppText>
            </PressScale>
          ) : null}

          <PrimaryButton
            label={last ? dict.onboarding.start : dict.onboarding.continue}
            onPress={onPrimary}
          />

          {last ? (
            <Pressable
              onPress={() => {
                complete();
                navigation.replace('Main');
              }}
              style={styles.skip}>
              <AppText variant="kicker" style={{ textAlign: 'center', color: colors.textMuted }}>
                {dict.onboarding.skip}
              </AppText>
            </Pressable>
          ) : null}
        </View>
      </View>
    </NightCanvas>
  );
}
