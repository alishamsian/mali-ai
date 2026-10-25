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
  const styles = useThemedStyles((colors, theme) => ({
    chip: {
      paddingHorizontal: 14,
      minHeight: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: theme.palette.surfaceSolid,
      justifyContent: 'center',
    },
    chipOn: {
      borderColor: colors.primary,
      backgroundColor: theme.palette.primaryGlow,
    },
    textOn: { color: colors.primary, fontFamily: theme.typography.fontFamily.medium },
  }));

  return (
    <PressScale onPress={onPress} style={[styles.chip, active && styles.chipOn]}>
      <AppText variant="caption" style={active ? styles.textOn : undefined}>
        {label}
      </AppText>
    </PressScale>
  );
}
