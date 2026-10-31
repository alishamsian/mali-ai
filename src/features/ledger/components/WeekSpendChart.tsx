import React, { useId, useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { AppText } from '../../../components/ui/AppText';
import { useThemedStyles } from '../../../theme/useThemedStyles';

const HEIGHT = 64;
const PAD = 8;

/**
 * Seven days of spending as one soft curve, right to left like the day strip above,
 * the selected day last and marked. Static SVG:
 * crisp at any size, light, and nothing to animate for reduced motion.
 */
export function WeekSpendChart({
  values,
  labels,
  color,
  gridColor,
  width,
}: {
  values: number[];
  labels: string[];
  color: string;
  gridColor: string;
  width: number;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const styles = useThemedStyles(c => ({
    labels: { flexDirection: 'row-reverse', justifyContent: 'space-between', paddingHorizontal: 2 },
    label: { width: 28, textAlign: 'center', fontSize: 11, color: c.textMuted },
    today: { color: c.text },
  }));
  const geometry = useMemo(() => {
    const top = Math.max(1, ...values) * 1.15;
    const step = (width - PAD * 2) / Math.max(1, values.length - 1);
    const points = values.map((rial, i) => ({
      x: width - PAD - i * step,
      y: HEIGHT - PAD - (rial / top) * (HEIGHT - PAD * 2),
    }));
    let line = `M ${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1];
      const b = points[i];
      const mid = (a.x + b.x) / 2;
      line += ` C ${mid},${a.y} ${mid},${b.y} ${b.x},${b.y}`;
    }
    const last = points[points.length - 1];
    const area = `${line} L ${last.x},${HEIGHT} L ${points[0].x},${HEIGHT} Z`;
    return { line, area, last, floor: HEIGHT - PAD };
  }, [values, width]);
  if (width <= 0 || values.length < 2) {
    return null;
  }
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={HEIGHT}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.22} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Line
          x1={PAD}
          y1={geometry.floor}
          x2={width - PAD}
          y2={geometry.floor}
          stroke={gridColor}
          strokeWidth={1}
        />
        <Path d={geometry.area} fill={`url(#${id})`} />
        <Path
          d={geometry.line}
          fill="none"
          stroke={color}
          strokeWidth={2.4}
          strokeLinecap="round"
        />
        <Circle cx={geometry.last.x} cy={geometry.last.y} r={7} fill={color} opacity={0.18} />
        <Circle cx={geometry.last.x} cy={geometry.last.y} r={3.6} fill={color} />
      </Svg>
      <View style={[styles.labels, { width }]}>
        {labels.map((label, i) => (
          <AppText key={i} style={[styles.label, i === labels.length - 1 && styles.today]}>
            {label}
          </AppText>
        ))}
      </View>
    </View>
  );
}
