import React from 'react';
import { View } from 'react-native';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { AppText } from './AppText';
import { PressScale } from './PressScale';

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  labelFor,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  labelFor: (v: T) => string;
}) {
  // Glass daylight: frosted pill track with an ink thumb; dark theme keeps the accent glow.
  const styles = useThemedStyles((colors, theme) => {
    const glass = theme.mode === 'light';
    return {
      track: {
        flexDirection: 'row-reverse',
        backgroundColor: glass ? colors.glass : theme.palette.surfaceSolid,
        borderRadius: glass ? 999 : 14,
        padding: 4,
        gap: 4,
        borderWidth: 1,
        borderColor: glass ? colors.glassBorder : colors.border,
      },
      segment: {
        flex: 1,
        minHeight: glass ? 40 : 36,
        borderRadius: glass ? 999 : 10,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
      },
      segmentOn: glass
        ? { backgroundColor: colors.primary }
        : {
            backgroundColor: theme.palette.primaryGlow,
            borderWidth: 1,
            borderColor: 'rgba(59,232,197,0.35)',
          },
      label: { color: glass ? colors.text : colors.textSecondary },
      labelOn: {
        color: glass ? colors.onPrimary : colors.primary,
        fontFamily: theme.typography.fontFamily.semibold,
      },
    };
  });

  return (
    <View style={styles.track} accessibilityRole="tablist">
      {options.map(opt => {
        const active = opt === value;
        return (
          <PressScale
            key={opt}
            onPress={() => onChange(opt)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && styles.segmentOn]}>
            <AppText variant="caption" style={active ? styles.labelOn : styles.label}>
              {labelFor(opt)}
            </AppText>
          </PressScale>
        );
      })}
    </View>
  );
}
