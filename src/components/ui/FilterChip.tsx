import React from 'react';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { AppText } from './AppText';
import { PressScale } from './PressScale';

export function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  // Glass daylight: frosted chip, ink when selected; dark theme keeps the accent glow.
  const styles = useThemedStyles((colors, theme) => {
    const glass = theme.mode === 'light';
    return {
      chip: {
        paddingHorizontal: 14,
        minHeight: glass ? 40 : 36,
        borderRadius: glass ? 999 : 18,
        borderWidth: 1,
        borderColor: glass ? colors.glassBorder : colors.border,
        backgroundColor: glass ? colors.glassStrong : theme.palette.surfaceSolid,
        justifyContent: 'center',
      },
      chipOn: {
        borderColor: colors.primary,
        backgroundColor: glass ? colors.primary : theme.palette.primaryGlow,
      },
      text: { color: glass ? colors.text : undefined },
      textOn: {
        color: glass ? colors.onPrimary : colors.primary,
        fontFamily: theme.typography.fontFamily.medium,
      },
    };
  });

  return (
    <PressScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(active) }}
      style={[styles.chip, active && styles.chipOn]}>
      <AppText variant="caption" style={active ? styles.textOn : styles.text}>
        {label}
      </AppText>
    </PressScale>
  );
}
