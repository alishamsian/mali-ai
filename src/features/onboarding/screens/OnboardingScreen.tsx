import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppText } from '../../../components/ui/AppText';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { t } from '../../../i18n';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { hapticTap } from '../../../utils/haptics';
import type { RootStackParamList } from '../../../app/navigation/types';
import { AutoVignette, OverviewVignette, PrivacyVignette } from '../components/IntroVignettes';

const PAGES = [
  { Vignette: OverviewVignette, title: 'introTitle1', body: 'introBody1' },
  { Vignette: AutoVignette, title: 'introTitle2', body: 'introBody2' },
  { Vignette: PrivacyVignette, title: 'introTitle3', body: 'introBody3' },
] as const;

/**
 * Three short pages, each a live slice of the app, then the quick setup. Swipe or tap
 * through; «رد شدن» goes straight to setup. Nothing is saved here.
 */
export function OnboardingScreen({
  navigation,
}: {
  navigation: NativeStackNavigationProp<RootStackParamList>;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const dict = t().onboarding;
  const [index, setIndex] = useState(0);
  const last = index === PAGES.length - 1;
  const page = PAGES[index];

  const go = (next: number) => {
    if (next < 0) {
      return;
    }
    if (next >= PAGES.length) {
      navigation.replace('QuickSetup');
      return;
    }
    hapticTap();
    setIndex(next);
  };
  // RTL: the next page comes from the left, so a swipe to the right moves forward.
  const swipe = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .onEnd(e => {
      if (e.translationX > 60) {
        runOnJS(go)(index + 1);
      } else if (e.translationX < -60) {
        runOnJS(go)(index - 1);
      }
    });

  const styles = useThemedStyles((c, th) => ({
    screen: {
      flex: 1,
      paddingTop: insets.top + 12,
      paddingBottom: insets.bottom + 20,
      paddingHorizontal: 24,
    },
    top: {
      flexDirection: 'row-reverse',
      justifyContent: 'space-between',
      alignItems: 'center',
      minHeight: 44,
    },
    brand: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
    },
    brandGlyph: {
      color: c.onPrimary,
      fontSize: 22,
      lineHeight: 32,
      fontFamily: th.typography.fontFamily.bold,
    },
    skip: { color: c.textMuted, fontSize: 14, padding: 8 },
    stage: { flex: 1, justifyContent: 'center' },
    text: { gap: 10, marginBottom: 28 },
    title: {
      textAlign: 'right',
      color: c.text,
      fontSize: 28,
      lineHeight: 42,
      fontFamily: th.typography.fontFamily.bold,
    },
    body: { textAlign: 'right', color: c.textSecondary, fontSize: 15, lineHeight: 26 },
    dots: { flexDirection: 'row-reverse', gap: 6, marginBottom: 20 },
    dot: { height: 6, borderRadius: 3 },
    restore: { alignItems: 'center', paddingTop: 14 },
    restoreText: { color: c.textMuted, fontSize: 13 },
  }));

  return (
    <NightCanvas>
      <GestureDetector gesture={swipe}>
        <View style={styles.screen}>
          <View style={styles.top}>
            <View style={styles.brand}>
              <AppText style={styles.brandGlyph}>پ</AppText>
            </View>
            {!last ? (
              <Pressable
                onPress={() => navigation.replace('QuickSetup')}
                accessibilityRole="button"
                hitSlop={10}>
                <AppText style={styles.skip}>{dict.skipIntro}</AppText>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.stage} key={`stage-${index}`}>
            <page.Vignette />
          </View>

          <Animated.View
            key={`text-${index}`}
            entering={FadeInDown.duration(380)}
            style={styles.text}>
            <AppText style={styles.title} accessibilityRole="header">
              {dict[page.title]}
            </AppText>
            <AppText style={styles.body}>{dict[page.body]}</AppText>
          </Animated.View>

          <View style={styles.dots} accessibilityLabel={`${index + 1} / ${PAGES.length}`}>
            {PAGES.map((_, i) => (
              <Animated.View
                key={i}
                entering={FadeIn}
                style={[
                  styles.dot,
                  {
                    width: i === index ? 22 : 6,
                    backgroundColor: i === index ? colors.text : colors.glassBorder,
                  },
                ]}
              />
            ))}
          </View>

          <PrimaryButton
            label={last ? dict.getStarted : dict.continue}
            onPress={() => go(index + 1)}
          />
          {index === 0 ? (
            <Pressable
              onPress={() => navigation.navigate('SettingsBackup')}
              style={styles.restore}
              accessibilityRole="button">
              <AppText style={styles.restoreText}>{dict.haveBackup}</AppText>
            </Pressable>
          ) : null}
        </View>
      </GestureDetector>
    </NightCanvas>
  );
}
