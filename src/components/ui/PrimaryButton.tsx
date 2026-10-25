import React from 'react';
import { StyleSheet, type PressableProps } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { theme } from '../../theme';
import { useAppTheme } from '../../theme/ThemeBridge';
import { AppText } from './AppText';
import { PressScale } from './PressScale';

export function PrimaryButton({
  label,
  style: _style,
  ...rest
}: PressableProps & { label: string }) {
  const { accent, colors, mode } = useAppTheme();
  // Glass daylight: solid ink. The accent gradient ran ink → grey under ink text there.
  const fill = mode === 'light' ? [colors.primary, colors.primary] : [colors.primary, accent.gradientEnd];
  return (
    <PressScale accessibilityRole="button" style={{ alignSelf: 'stretch' }} {...rest}>
      <LinearGradient
        colors={fill}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.btn}>
        <AppText variant="label" style={[styles.label, { color: colors.onPrimary }]}>
          {label}
        </AppText>
      </LinearGradient>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  label: {
    color: theme.palette.ink,
    fontFamily: theme.typography.fontFamily.semibold,
    fontSize: 16,
    textAlign: 'center',
    width: undefined,
  },
});
