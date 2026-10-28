import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useAppTheme } from '../../theme/ThemeBridge';

const BARS = [0.45, 0.8, 0.6, 1, 0.7, 0.9, 0.5, 0.75, 0.55];
const MAX_HEIGHT = 44;

function Bar({
  active,
  peak,
  index,
  color,
}: {
  active: boolean;
  peak: number;
  index: number;
  color: string;
}) {
  const level = useSharedValue(0.15);
  useEffect(() => {
    if (active) {
      level.value = withDelay(
        index * 70,
        withRepeat(
          withSequence(withTiming(peak, { duration: 320 }), withTiming(0.2, { duration: 320 })),
          -1,
          true,
        ),
      );
    } else {
      cancelAnimation(level);
      level.value = withTiming(0.15, { duration: 200 });
    }
  }, [active, index, level, peak]);
  const style = useAnimatedStyle(() => ({ height: Math.max(4, level.value * MAX_HEIGHT) }));
  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

/** Decorative listening indicator; it moves while the recognizer is listening. */
export function VoiceWaveform({ active }: { active: boolean }) {
  const { colors } = useAppTheme();
  return (
    <View
      style={styles.row}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {BARS.map((peak, i) => (
        <Bar
          key={i}
          active={active}
          peak={peak}
          index={i}
          color={active ? colors.highlight : colors.textMuted}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: MAX_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  bar: { width: 5, borderRadius: 3 },
});
