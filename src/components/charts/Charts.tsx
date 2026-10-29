import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, LinearGradient, Path, Skia, vec } from '@shopify/react-native-skia';
import { Area, CartesianChart, Line, Pie, PolarChart } from 'victory-native';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';
import { AppText } from '../ui/AppText';
import { theme } from '../../theme';
import { useAppTheme } from '../../theme/ThemeBridge';
import { toPersianDigits } from '../../utils/numbers/digits';

const ANIMATE = { type: 'timing', duration: 600 } as const;

/** Small trend line with a soft gradient fill (Victory Native on Skia). */
export function Sparkline({
  points,
  color,
  width = 280,
  height = 64,
}: {
  points: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  const { colors } = useAppTheme();
  const stroke = color ?? colors.primary;
  const data = useMemo(() => points.map((y, x) => ({ x, y })), [points]);
  if (points.length < 2) {
    return null;
  }
  return (
    <View
      style={{ width, height }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <CartesianChart data={data} xKey="x" yKeys={['y']} padding={{ top: 4, bottom: 2 }}>
        {({ points: pts, chartBounds }) => (
          <>
            <Area points={pts.y} y0={chartBounds.bottom} curveType="natural" animate={ANIMATE}>
              <LinearGradient
                start={vec(0, chartBounds.top)}
                end={vec(0, chartBounds.bottom)}
                colors={[`${stroke}59`, `${stroke}00`]}
              />
            </Area>
            <Line
              points={pts.y}
              color={stroke}
              strokeWidth={2.2}
              curveType="natural"
              animate={ANIMATE}
            />
          </>
        )}
      </CartesianChart>
    </View>
  );
}

/** Ring chart; slices sweep in. Callers overlay their own centre label. */
export function DonutChart({
  slices,
  size = 220,
}: {
  slices: Array<{ value: number; color: string }>;
  size?: number;
}) {
  const data = useMemo(
    () => slices.map((s, i) => ({ label: String(i), value: s.value, color: s.color })),
    [slices],
  );
  if (data.length === 0) {
    return <View style={{ width: size, height: size }} />;
  }
  return (
    <View
      style={{ width: size, height: size }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <PolarChart data={data} labelKey="label" valueKey="value" colorKey="color">
        <Pie.Chart innerRadius="78%">{() => <Pie.Slice animate={ANIMATE} />}</Pie.Chart>
      </PolarChart>
    </View>
  );
}

/** 270° score gauge that fills to its value. */
export function ArcGauge({
  value,
  caption,
  size = 128,
}: {
  value: number;
  caption: string;
  size?: number;
}) {
  const { colors } = useAppTheme();
  const clamped = Math.max(0, Math.min(100, value));
  const color =
    clamped >= 80
      ? colors.income
      : clamped >= 65
      ? colors.primary
      : clamped >= 48
      ? colors.filament
      : colors.expense;
  const stroke = 11;
  const arc = useMemo(() => {
    const path = Skia.Path.Make();
    const inset = stroke / 2 + 3;
    path.addArc(
      { x: inset, y: inset, width: size - inset * 2, height: size - inset * 2 },
      135,
      270,
    );
    return path;
  }, [size]);
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = withTiming(clamped / 100, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [clamped, fill]);

  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Path
          path={arc}
          style="stroke"
          strokeWidth={stroke}
          strokeCap="round"
          color={`${colors.text}14`}
        />
        <Path path={arc} style="stroke" strokeWidth={stroke} strokeCap="round" end={fill}>
          <LinearGradient start={vec(0, size)} end={vec(size, 0)} colors={[`${color}99`, color]} />
        </Path>
      </Canvas>
      <View style={styles.gaugeCenter} pointerEvents="none">
        <AppText style={[styles.gaugeValue, { color: colors.text }]}>
          {toPersianDigits(Math.round(clamped))}
        </AppText>
        <AppText style={[styles.gaugeCaption, { color: theme.palette.filament }]}>
          {caption}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gaugeCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  gaugeValue: { fontSize: 28, lineHeight: 36, fontFamily: theme.typography.fontFamily.bold },
  gaugeCaption: { fontSize: 10, fontFamily: theme.typography.fontFamily.medium },
});
