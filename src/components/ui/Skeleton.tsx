import React, { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useAppMotion } from '../../hooks/useAppMotion';
import { useThemedStyles } from '../../theme/useThemedStyles';

export function Skeleton({
  width,
  height = 14,
  radius = 8,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { duration } = useAppMotion();
  const pulse = useSharedValue(0.35);
  const styles = useThemedStyles(c => ({
    bone: {
      backgroundColor: c.border,
      overflow: 'hidden',
    },
  }));

  useEffect(() => {
    if (duration.normal === 0) {
      pulse.value = 0.55;
      return;
    }
    pulse.value = withRepeat(
      withTiming(0.75, { duration: duration.normal + 300, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse, duration.normal]);

  const anim = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={[
        styles.bone,
        anim,
        { width: width ?? '100%', height, borderRadius: radius },
        style,
      ]}
    />
  );
}

export function SkeletonRow() {
  const styles = useThemedStyles((_c, th) => ({
    row: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: th.spacing.sm,
      paddingVertical: th.spacing.md,
    },
    meta: { flex: 1, gap: 8, alignItems: 'flex-end' },
  }));

  return (
    <View style={styles.row}>
      <Skeleton width={72} height={18} radius={10} />
      <View style={styles.meta}>
        <Skeleton width="55%" height={14} />
        <Skeleton width="35%" height={11} radius={6} />
      </View>
      <Skeleton width={46} height={46} radius={14} />
    </View>
  );
}
