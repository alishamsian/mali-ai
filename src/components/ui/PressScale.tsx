import React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useFinanceStore } from '../../store/finance/store';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressScale({
  children,
  style,
  ...rest
}: PressableProps & { style?: StyleProp<ViewStyle> }) {
  const reduced = useFinanceStore(s => s.snapshot.settings.reducedMotion);
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      style={[style, anim]}
      onPressIn={e => {
        if (!reduced) {
          scale.value = withSpring(0.97, { damping: 18, stiffness: 420 });
        }
        rest.onPressIn?.(e);
      }}
      onPressOut={e => {
        scale.value = withSpring(1, { damping: 16, stiffness: 380 });
        rest.onPressOut?.(e);
      }}>
      {children}
    </AnimatedPressable>
  );
}
