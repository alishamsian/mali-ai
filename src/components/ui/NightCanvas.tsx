import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { useAppTheme } from '../../theme/ThemeBridge';
import { getCurrentAccent } from '../../theme/runtime';

/** Soft daylight backdrop: blurred blue and sand light pools behind the glass panels. */
function DaylightBackdrop() {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      preserveAspectRatio="none"
      viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id="sky" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#A9C8E2" stopOpacity="1" />
          <Stop offset="1" stopColor="#A9C8E2" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="sand" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#EAD592" stopOpacity="0.95" />
          <Stop offset="1" stopColor="#EAD592" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="mist" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#B4CDE0" stopOpacity="0.9" />
          <Stop offset="1" stopColor="#B4CDE0" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Ellipse cx="88" cy="6" rx="70" ry="34" fill="url(#sky)" />
      <Ellipse cx="0" cy="52" rx="62" ry="30" fill="url(#sand)" />
      <Ellipse cx="92" cy="100" rx="72" ry="32" fill="url(#mist)" />
    </Svg>
  );
}

export function NightCanvas({ children, style, ...rest }: ViewProps) {
  const { mode, accent, colors } = useAppTheme();
  const isLight = mode === 'light';
  const a = accent ?? getCurrentAccent();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }, style]} {...rest}>
      {isLight ? (
        <DaylightBackdrop />
      ) : (
        <>
          <View pointerEvents="none" style={[styles.orbA, { backgroundColor: a.orb }]} />
          <View
            pointerEvents="none"
            style={[styles.orbB, { backgroundColor: 'rgba(139, 124, 255, 0.1)' }]}
          />
          <View
            pointerEvents="none"
            style={[styles.veil, { backgroundColor: 'rgba(4, 6, 8, 0.18)' }]}
          />
        </>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  orbA: {
    position: 'absolute',
    top: -90,
    right: -70,
    width: 280,
    height: 280,
    borderRadius: 140,
  },
  orbB: {
    position: 'absolute',
    bottom: 80,
    left: -90,
    width: 240,
    height: 240,
    borderRadius: 120,
  },
  veil: {
    ...StyleSheet.absoluteFillObject,
  },
});
