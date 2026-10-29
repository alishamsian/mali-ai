import React, { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import {
  Canvas,
  Circle,
  DashPathEffect,
  Group,
  LinearGradient,
  Line,
  Path,
  vec,
} from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { hapticTap } from '../../utils/haptics';
import { AppText } from '../ui/AppText';
import { PressScale } from '../ui/PressScale';
import { useAppTheme } from '../../theme/ThemeBridge';
import { theme } from '../../theme';
import type { SpendPoint } from '../../engine/insights/spendSeries';
import { toPersianDigits } from '../../utils/numbers/digits';

const CHART_H = 170;
const TOP = 34;
const PAD = 22;
const DRAW_MS = 650;

type Pt = { x: number; y: number };

/** Monotone-ish smoothing: cubic segments through every point, no overshoot past neighbours. */
function smoothPath(pts: Pt[]): string {
  if (pts.length === 0) {
    return '';
  }
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i += 1) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const dx = (p1.x - p0.x) / 2;
    d += ` C${p0.x + dx} ${p0.y} ${p1.x - dx} ${p1.y} ${p1.x} ${p1.y}`;
  }
  return d;
}

/** This period vs last: deep amber (≈3:1 on the glass backdrop) and a dashed grey reference. */
export const CURRENT_LINE = '#A86E10';
export const PREVIOUS_LINE = '#8A939C';

/**
 * Two-line comparison chart, first point on the right (RTL). Tapping a label selects
 * that point; future points (current === null) cannot be selected.
 */
export function CompareLineChart({
  points,
  selected,
  onSelect,
  formatValue,
}: {
  points: SpendPoint[];
  selected: number;
  onSelect: (index: number) => void;
  formatValue: (rial: number) => string;
}) {
  const { colors, mode } = useAppTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const n = points.length;
  const step = n > 1 ? (width - PAD * 2) / (n - 1) : 0;
  const xAt = (i: number) => width - PAD - i * step;
  const max = Math.max(1, ...points.map(p => Math.max(p.current ?? 0, p.previous)));
  const yAt = (v: number) => CHART_H - (v / max) * (CHART_H - TOP);
  const toPts = (vals: Array<number | null>) =>
    vals.flatMap((v, i) => (v === null ? [] : [{ x: xAt(i), y: yAt(v) }]));
  const currentPts = toPts(points.map(p => p.current));
  const currentD = smoothPath(currentPts);
  const previousD = smoothPath(toPts(points.map(p => p.previous)));
  const areaD =
    currentPts.length > 1
      ? `${currentD} L${currentPts[currentPts.length - 1].x} ${CHART_H} L${
          currentPts[0].x
        } ${CHART_H} Z`
      : '';
  // Skia takes SVG path strings directly.
  const skPaths = { current: currentD || 'M0 0', previous: previousD || 'M0 0', area: areaD || 'M0 0' };

  // Lines draw in when the data changes (week ↔ months).
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: DRAW_MS, easing: Easing.out(Easing.cubic) });
  }, [currentD, previousD, progress]);

  // Drag across the chart to scrub; a light tick on each new point.
  const selectAt = (x: number) => {
    if (n < 2 || step <= 0) {
      return;
    }
    const i = Math.max(0, Math.min(n - 1, Math.round((width - PAD - x) / step)));
    if (i !== selected && points[i]?.current !== null) {
      hapticTap();
      onSelect(i);
    }
  };
  const scrub = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .onBegin(e => runOnJS(selectAt)(e.x))
    .onUpdate(e => runOnJS(selectAt)(e.x));

  const sel = points[selected];
  const selValue = sel?.current ?? 0;
  const tipW = 104;
  const tipLeft = Math.max(0, Math.min(width - tipW, xAt(selected) - tipW / 2));
  const gridColor = mode === 'light' ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.05)';
  const labelW = Math.min(64, Math.max(44, step));

  return (
    <View onLayout={onLayout} style={styles.root}>
      {width > 0 ? (
        <>
          <GestureDetector gesture={scrub}>
            <Canvas
              style={{ width, height: CHART_H }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants">
              {Array.from({ length: Math.floor(width / 15) }, (_, i) => (
                <Line
                  key={i}
                  p1={vec(6 + i * 15, 18)}
                  p2={vec(6 + i * 15, CHART_H)}
                  color={gridColor}
                  strokeWidth={2}
                />
              ))}
              <Path path={skPaths.area} start={0} end={progress}>
                <LinearGradient
                  start={vec(0, TOP)}
                  end={vec(0, CHART_H)}
                  colors={[`${CURRENT_LINE}55`, `${CURRENT_LINE}00`]}
                />
              </Path>
              <Path
                path={skPaths.previous}
                style="stroke"
                strokeWidth={1.8}
                color={PREVIOUS_LINE}
                strokeJoin="round"
                end={progress}>
                <DashPathEffect intervals={[5, 4]} />
              </Path>
              <Path
                path={skPaths.current}
                style="stroke"
                strokeWidth={3}
                color={CURRENT_LINE}
                strokeJoin="round"
                strokeCap="round"
                end={progress}
              />
              {sel && sel.current !== null ? (
                <Group>
                  <Line
                    p1={vec(xAt(selected), yAt(selValue))}
                    p2={vec(xAt(selected), CHART_H)}
                    color={colors.text}
                    strokeWidth={1.5}
                  />
                  <Circle cx={xAt(selected)} cy={yAt(selValue)} r={9} color={`${CURRENT_LINE}33`} />
                  <Circle cx={xAt(selected)} cy={yAt(selValue)} r={5} color={colors.text} />
                </Group>
              ) : null}
            </Canvas>
          </GestureDetector>
          {sel && sel.current !== null ? (
            <View
              pointerEvents="none"
              style={[
                styles.tip,
                {
                  left: tipLeft,
                  top: Math.max(0, yAt(selValue) - 40),
                  width: tipW,
                  backgroundColor: colors.primary,
                },
              ]}>
              <AppText style={[styles.tipText, { color: colors.onPrimary }]} numberOfLines={1}>
                {formatValue(selValue)}
              </AppText>
            </View>
          ) : null}
          <View style={styles.labels}>
            {points.map((p, i) => {
              const future = p.current === null;
              const on = i === selected;
              return (
                <PressScale
                  key={`${p.name}-${i}`}
                  disabled={future}
                  onPress={() => onSelect(i)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on, disabled: future }}
                  accessibilityLabel={future ? p.name : `${p.name}، ${formatValue(p.current ?? 0)}`}
                  style={[styles.label, { left: xAt(i) - labelW / 2, width: labelW }]}>
                  <AppText
                    numberOfLines={1}
                    style={[
                      styles.labelTop,
                      {
                        color: on ? colors.text : future ? colors.textMuted : colors.textSecondary,
                        fontFamily: on
                          ? theme.typography.fontFamily.bold
                          : theme.typography.fontFamily.medium,
                        fontSize: p.sub ? 13 : 11,
                      },
                    ]}>
                    {p.label}
                  </AppText>
                  {p.sub ? (
                    <AppText
                      style={[styles.labelSub, { color: on ? colors.text : colors.textMuted }]}>
                      {toPersianDigits(p.sub)}
                    </AppText>
                  ) : null}
                </PressScale>
              );
            })}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { height: CHART_H + 48 },
  tip: { position: 'absolute', paddingVertical: 4, borderRadius: 9, alignItems: 'center' },
  tipText: { fontSize: 13, fontFamily: theme.typography.fontFamily.semibold },
  labels: { position: 'absolute', top: CHART_H + 2, left: 0, right: 0, height: 44 },
  label: { position: 'absolute', height: 44, alignItems: 'center', justifyContent: 'center' },
  labelTop: { textAlign: 'center' },
  labelSub: { fontSize: 11, textAlign: 'center' },
});
