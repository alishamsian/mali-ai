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
      backgroundColor: c.backgroundElevated,
      borderRadius: th.radii.lg,
      borderWidth: 1,
      borderColor: c.border,
    },
    raised: {
      backgroundColor: c.surfaceSolid,
      borderRadius: th.radii.lg,
      borderWidth: 1,
      borderColor: c.border,
    },
    interactive: {
      backgroundColor: th.palette.surfaceElevated,
      borderRadius: th.radii.md,
      borderWidth: 1,
      borderColor: c.border,
    },
    glass: {
      backgroundColor: c.surface,
      borderRadius: th.radii.lg,
      borderWidth: 1,
      borderColor: c.border,
    },
    pad: { padding: th.spacing.lg },
  }));

  return (
    <View style={[styles[level], padded && styles.pad, style]} {...rest}>
      {children}
    </View>
  );
}
