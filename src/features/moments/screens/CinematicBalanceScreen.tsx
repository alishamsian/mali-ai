import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../components/ui/AppText';
import { CountToman } from '../../../components/ui/CountToman';
import { useFinanceStore } from '../../../store/finance/store';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { t } from '../../../i18n';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../app/navigation/types';

export function CinematicBalanceScreen({
  navigation,
}: {
  navigation: NativeStackNavigationProp<RootStackParamList, 'CinematicBalance'>;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const dict = t();
  const snapshot = useFinanceStore(s => s.snapshot);
  const hidden = snapshot.settings.hideBalances;
  const total = snapshot.accounts.reduce((s, a) => s + a.balanceRial, 0);
  const breath = useSharedValue(0);

  useEffect(() => {
    if (snapshot.settings.reducedMotion) {
      return;
    }
    breath.value = withRepeat(
      withTiming(1, { duration: 4800, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [breath, snapshot.settings.reducedMotion]);

  const aura = useAnimatedStyle(() => ({
    opacity: 0.25 + breath.value * 0.35,
    transform: [{ scale: 0.92 + breath.value * 0.12 }],
  }));

  return (
    <Pressable style={styles.root} onPress={() => navigation.goBack()}>
      <LinearGradient colors={['#040608', '#0A1418', '#061012']} style={StyleSheet.absoluteFill} />
      <Animated.View
        style={[
          styles.glow,
          aura,
          { backgroundColor: colors.primary, top: insets.top + 80 },
        ]}
      />
      <View style={[styles.content, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 }]}>
        <AppText variant="kicker" style={{ color: colors.textMuted, textAlign: 'center' }}>
          {dict.moments.cinematicKicker}
        </AppText>
        <AppText style={[styles.hint, { color: colors.filament }]}>{dict.moments.cinematicHint}</AppText>
        <CountToman
          rial={total}
          hidden={hidden}
          style={{
            fontSize: 48,
            textAlign: 'center',
            marginTop: 32,
            color: colors.text,
            fontFamily: 'Vazirmatn-SemiBold',
          }}
        />
        <AppText variant="caption" style={{ textAlign: 'center', marginTop: 12, color: colors.textMuted }}>
          {dict.common.toman}
        </AppText>
        <AppText variant="caption" style={styles.tap}>
          {dict.moments.cinematicTap}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  glow: {
    position: 'absolute',
    alignSelf: 'center',
    width: 280,
    height: 280,
    borderRadius: 140,
  },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  hint: { textAlign: 'center', marginTop: 12, fontSize: 15, lineHeight: 26 },
  tap: { textAlign: 'center', marginTop: 48, opacity: 0.55 },
});
