import React from 'react';
import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { useThemedStyles } from '../../theme/useThemedStyles';

type SurfaceLevel = 'base' | 'raised' | 'interactive' | 'glass';

export function Surface({
  level = 'raised',
  padded = false,
  style,
  children,
  ...rest
}: ViewProps & {
  level?: SurfaceLevel;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useThemedStyles((c, th) => ({
    base: {
      backgroundColor: c.glass,
      borderRadius: th.radii.lg,
      borderWidth: 1,
      borderColor: c.glassBorder,
    },
    raised: {
      backgroundColor: c.glassStrong,
      borderRadius: th.radii.lg,
      borderWidth: 1,
      borderColor: c.glassBorder,
    },
    interactive: {
      backgroundColor: c.glassStrong,
      borderRadius: th.radii.md,
      borderWidth: 1,
      borderColor: c.glassBorder,
    },
    glass: {
      backgroundColor: c.glass,
      borderRadius: th.radii.lg,
      borderWidth: 1,
      borderColor: c.glassBorder,
    },
    pad: { padding: th.spacing.lg },
  }));

  return (
    <View style={[styles[level], padded && styles.pad, style]} {...rest}>
      {children}
    </View>
  );
}
