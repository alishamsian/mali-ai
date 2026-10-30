import React, { useId, useMemo } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

/** A small static SVG chart: lightweight and naturally honours reduced motion. */
export function WealthTrend({
  values,
  color,
  width = 168,
  height = 58,
}: {
  values: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const geometry = useMemo(() => {
    const min = Math.min(...values);
    const span = Math.max(...values) - min;
    const points = values.map((value, index) => ({
      x: 4 + (index / Math.max(1, values.length - 1)) * (width - 8),
      y: span === 0 ? height / 2 : 6 + (1 - (value - min) / span) * (height - 16),
    }));
    let path = `M ${points[0]?.x ?? 0},${points[0]?.y ?? 0}`;
    for (let i = 1; i < points.length; i += 1) {
      const previous = points[i - 1];
      const next = points[i];
      const mid = (previous.x + next.x) / 2;
      path += ` C ${mid},${previous.y} ${mid},${next.y} ${next.x},${next.y}`;
    }
    const last = points[points.length - 1];
    return { path, last, area: `${path} L ${width - 4},${height} L 4,${height} Z` };
  }, [values, width, height]);
  if (values.length < 2 || !geometry.last) {
    return null;
  }
  return (
    <Svg
      width={width}
      height={height}
      accessible={false}
      importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.2} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={geometry.area} fill={`url(#${id})`} />
      <Path d={geometry.path} fill="none" stroke={color} strokeWidth={2} />
      <Circle cx={geometry.last.x} cy={geometry.last.y} r={3} fill={color} />
    </Svg>
  );
}
