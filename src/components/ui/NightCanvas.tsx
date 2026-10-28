import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { useAppTheme } from '../../theme/ThemeBridge';

type Pools = { sky: string; sand: string; mist: string; opacity: [number, number, number] };

const DAY_POOLS: Pools = { sky: '#A9C8E2', sand: '#EAD592', mist: '#B4CDE0', opacity: [1, 0.95, 0.9] };
/** Same composition at night: deep blue and dim amber so the dark glass has depth too. */
const NIGHT_POOLS: Pools = { sky: '#1F4466', sand: '#6B5216', mist: '#173A52', opacity: [0.55, 0.4, 0.5] };

/** Soft backdrop: blurred blue and sand light pools behind the glass panels. */
function GlassBackdrop({ pools }: { pools: Pools }) {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      preserveAspectRatio="none"
      viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id="sky" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={pools.sky} stopOpacity={pools.opacity[0]} />
          <Stop offset="1" stopColor={pools.sky} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="sand" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={pools.sand} stopOpacity={pools.opacity[1]} />
          <Stop offset="1" stopColor={pools.sand} stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="mist" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={pools.mist} stopOpacity={pools.opacity[2]} />
          <Stop offset="1" stopColor={pools.mist} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Ellipse cx="88" cy="6" rx="70" ry="34" fill="url(#sky)" />
      <Ellipse cx="0" cy="52" rx="62" ry="30" fill="url(#sand)" />
      <Ellipse cx="92" cy="100" rx="72" ry="32" fill="url(#mist)" />
    </Svg>
  );
}

export function NightCanvas({ children, style, ...rest }: ViewProps) {
  const { mode, colors } = useAppTheme();
  const isLight = mode === 'light';

  return (
    <View style={[styles.root, { backgroundColor: colors.background }, style]} {...rest}>
      <GlassBackdrop pools={isLight ? DAY_POOLS : NIGHT_POOLS} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
});
