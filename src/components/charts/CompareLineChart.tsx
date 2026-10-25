import React, { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { AppText } from '../ui/AppText';
import { PressScale } from '../ui/PressScale';
import { useAppTheme } from '../../theme/ThemeBridge';
import { theme } from '../../theme';
import type { SpendPoint } from '../../engine/insights/spendSeries';
import { toPersianDigits } from '../../utils/numbers/digits';

const CHART_H = 170;
const TOP = 34;
const PAD = 22;

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
  const path = (vals: Array<number | null>) =>
    vals.reduce<string>((d, v, i) => {
      if (v === null) {
        return d;
      }
      return `${d}${d ? ' L' : 'M'}${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`;
    }, '');

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
          <Svg width={width} height={CHART_H} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {Array.from({ length: Math.floor(width / 15) }, (_, i) => (
              <Line key={i} x1={6 + i * 15} x2={6 + i * 15} y1={18} y2={CHART_H} stroke={gridColor} strokeWidth={2} />
            ))}
            <Path
              d={path(points.map(p => p.previous))}
              fill="none"
              stroke={PREVIOUS_LINE}
              strokeWidth={1.8}
              strokeDasharray="5 4"
              strokeLinejoin="round"
            />
            <Path
              d={path(points.map(p => p.current))}
              fill="none"
              stroke={CURRENT_LINE}
              strokeWidth={2.6}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {sel && sel.current !== null ? (
              <>
                <Line x1={xAt(selected)} x2={xAt(selected)} y1={yAt(selValue)} y2={CHART_H} stroke={colors.text} strokeWidth={2} />
                <Circle cx={xAt(selected)} cy={yAt(selValue)} r={5} fill={colors.text} />
              </>
            ) : null}
          </Svg>
          {sel && sel.current !== null ? (
            <View
              pointerEvents="none"
              style={[styles.tip, { left: tipLeft, top: Math.max(0, yAt(selValue) - 40), width: tipW, backgroundColor: colors.primary }]}>
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
                        fontFamily: on ? theme.typography.fontFamily.bold : theme.typography.fontFamily.medium,
                        fontSize: p.sub ? 13 : 11,
                      },
                    ]}>
                    {p.label}
                  </AppText>
                  {p.sub ? (
                    <AppText style={[styles.labelSub, { color: on ? colors.text : colors.textMuted }]}>
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
