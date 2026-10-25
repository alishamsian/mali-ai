import React from 'react';
import Svg, { Circle, Defs, LinearGradient as SvgGrad, Path, Stop, Text as SvgText } from 'react-native-svg';
import { theme } from '../../theme';
import { useAppTheme } from '../../theme/ThemeBridge';
import { toPersianDigits } from '../../utils/numbers/digits';

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
  if (points.length < 2) {
    return null;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = i * step;
    const y = height - ((p - min) / span) * (height - 8) - 4;
    return { x, y };
  });
  const line = coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;
  const gid = `spark-${stroke.replace('#', '')}-${width}`;
  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgGrad id={gid} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={stroke} stopOpacity="0.35" />
          <Stop offset="1" stopColor={stroke} stopOpacity="0" />
        </SvgGrad>
      </Defs>
      <Path d={area} fill={`url(#${gid})`} />
      <Path d={line} stroke={stroke} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function DonutChart({
  slices,
  size = 220,
}: {
  slices: Array<{ value: number; color: string }>;
  size?: number;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const r = size / 2 - 18;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(243,241,234,0.06)" strokeWidth={16} fill="none" />
      {slices.map((slice, i) => {
        const len = (slice.value / total) * c;
        const el = (
          <Circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={slice.color}
            strokeWidth={16}
            fill="none"
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
        offset += len;
        return el;
      })}
    </Svg>
  );
}

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
  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  const track = c * 0.75;
  const filled = (clamped / 100) * track;
  const color =
    clamped >= 80
      ? colors.income
      : clamped >= 65
        ? colors.primary
        : clamped >= 48
          ? colors.filament
          : colors.expense;
  return (
    <Svg width={size} height={size}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="rgba(243,241,234,0.08)"
        strokeWidth={11}
        fill="none"
        strokeDasharray={`${track} ${c}`}
        strokeLinecap="round"
        transform={`rotate(135 ${size / 2} ${size / 2})`}
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={11}
        fill="none"
        strokeDasharray={`${filled} ${c}`}
        strokeLinecap="round"
        transform={`rotate(135 ${size / 2} ${size / 2})`}
      />
      <SvgText
        x={size / 2}
        y={size / 2 + 4}
        fill={colors.text}
        fontSize="28"
        fontFamily={theme.typography.fontFamily.bold}
        textAnchor="middle">
        {toPersianDigits(Math.round(clamped))}
      </SvgText>
      <SvgText
        x={size / 2}
        y={size / 2 + 24}
        fill={theme.palette.filament}
        fontSize="10"
        fontFamily={theme.typography.fontFamily.medium}
        textAnchor="middle">
        {caption}
      </SvgText>
    </Svg>
  );
}
