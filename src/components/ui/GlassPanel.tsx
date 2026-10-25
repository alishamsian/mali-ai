import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { useAppTheme } from '../../theme/ThemeBridge';

/**
 * Frosted panel for the glass daylight look. `strong` is the brighter chip/tile
 * level used on top of a panel. In the dark theme it falls back to the solid surfaces.
 */
export function GlassPanel({
  strong = false,
  radius = 28,
  style,
  children,
  ...rest
}: ViewProps & { strong?: boolean; radius?: number; style?: StyleProp<ViewStyle> }) {
  const { colors, mode } = useAppTheme();
  const light = mode === 'light';
  return (
    <View
      style={[
        styles.base,
        {
          borderRadius: radius,
          backgroundColor: strong ? colors.glassStrong : colors.glass,
          borderColor: colors.glassBorder,
          shadowOpacity: light ? (strong ? 0.07 : 0.08) : 0,
        },
        style,
      ]}
      {...rest}>
      {children}
    </View>
  );
}

// No Android `elevation`: on translucent views it paints a grey rectangle through the glass.
const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    shadowColor: '#28405A',
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
});
