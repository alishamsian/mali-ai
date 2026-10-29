import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Canvas, Group, LinearGradient, Path, RoundedRect, vec } from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { AppText } from '../../../components/ui/AppText';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { t } from '../../../i18n';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { formatCompactToman } from '../../../utils/currency/money';
import { toPersianDigits } from '../../../utils/numbers/digits';
import { moneyFlow, type FlowNode } from '../../../engine/insights/moneyFlow';
import type { Transaction } from '../../../types/finance';

const HEIGHT = 168;
const NODE_W = 10;
/** Destinations sit further apart than sources, so ribbons fan out instead of running flat. */
const SINK_GAP = 14;
const SOURCE_GAP = 6;
/** Spending categories in order of size; savings and «other» have fixed colours. */
const SINK_COLORS = ['#E9A23B', '#5B8DEF', '#B46BE0', '#E2667A', '#3FB6A8'];

type Placed = FlowNode & { y: number; h: number; color: string };

function place(
  nodes: FlowNode[],
  total: number,
  colorOf: (n: FlowNode, i: number) => string,
  gap: number,
  usableHeight: number,
): Placed[] {
  const usable = usableHeight - gap * Math.max(0, nodes.length - 1);
  // Centred in the chart height.
  let y = (HEIGHT - usableHeight) / 2;
  return nodes.map((n, i) => {
    const h = Math.max(3, (n.rial / total) * usable);
    const placed = { ...n, y, h, color: colorOf(n, i) };
    y += h + gap;
    return placed;
  });
}

/**
 * Where this month's money came from and went, right to left: income on the right,
 * spending categories and savings on the left. Ribbons fade from the source colour to the
 * destination colour; the legend underneath carries the names and amounts.
 */
export function MoneyFlowCard({
  transactions,
  hidden,
}: {
  transactions: Transaction[];
  hidden: boolean;
}) {
  const { colors } = useAppTheme();
  const dict = t();
  const [width, setWidth] = useState(0);
  const flow = useMemo(() => moneyFlow(transactions), [transactions]);

  const grow = useSharedValue(0);
  useEffect(() => {
    grow.value = 0;
    grow.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [flow, grow]);
  const reveal = useDerivedValue(() => grow.value);

  const styles = useThemedStyles((c, th) => ({
    panel: { padding: 18, gap: 14 },
    head: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'baseline' },
    kicker: { textAlign: 'right', color: c.textMuted, fontSize: 12 },
    legend: { gap: 8 },
    item: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
    dot: { width: 10, height: 10, borderRadius: 3 },
    name: { flex: 1, textAlign: 'right', color: c.text, fontSize: 13 },
    pct: { width: 40, textAlign: 'left', color: c.textMuted, fontSize: 12 },
    amount: {
      minWidth: 76,
      textAlign: 'left',
      color: c.text,
      fontSize: 13,
      fontFamily: th.typography.fontFamily.semibold,
    },
    divider: { height: 1, backgroundColor: c.glassBorder },
  }));

  if (!flow || flow.totalRial <= 0) {
    return null;
  }

  const nameOf = (id: FlowNode['id']) =>
    id === 'other'
      ? dict.moneyFlow.other
      : id === 'savings'
      ? dict.moneyFlow.savings
      : id === 'balance'
      ? dict.moneyFlow.balance
      : dict.categories[id];
  const sinkColor = (n: FlowNode, i: number) =>
    n.id === 'savings'
      ? colors.income
      : n.id === 'other'
      ? colors.textMuted
      : SINK_COLORS[i % SINK_COLORS.length];
  const sourceColor = (n: FlowNode) => (n.id === 'balance' ? colors.textMuted : colors.primary);

  const sinks = place(flow.sinks, flow.totalRial, sinkColor, SINK_GAP, HEIGHT);
  // The income column is shorter and centred, so its ribbons spread to the destinations.
  const sources = place(flow.sources, flow.totalRial, sourceColor, SOURCE_GAP, HEIGHT * 0.62);

  // Ribbon i→j carries source_i × sink_j / total, stacked in order on both ends.
  const ribbons: { d: string; from: string; to: string }[] = [];
  if (width > 0) {
    const x1 = width - NODE_W;
    const x0 = NODE_W;
    const mid = width / 2;
    const sinkCursor = sinks.map(s => s.y);
    for (const src of sources) {
      let srcCursor = src.y;
      sinks.forEach((sink, j) => {
        const hSrc = src.h * (sink.rial / flow.totalRial);
        const hSink = sink.h * (src.rial / flow.totalRial);
        if (hSrc <= 0.2) {
          return;
        }
        const a = srcCursor;
        const b = sinkCursor[j];
        ribbons.push({
          d: `M${x1},${a} C${mid},${a} ${mid},${b} ${x0},${b} L${x0},${b + hSink} C${mid},${
            b + hSink
          } ${mid},${a + hSrc} ${x1},${a + hSrc} Z`,
          from: src.color,
          to: sink.color,
        });
        srcCursor += hSrc;
        sinkCursor[j] += hSink;
      });
    }
  }

  const money = (rial: number) => (hidden ? '••••' : formatCompactToman(rial));
  const pct = (rial: number) => `${toPersianDigits(Math.round((rial / flow.totalRial) * 100))}٪`;
  const legendRow = (n: Placed) => (
    <View key={`${n.id}`} style={styles.item}>
      <View style={[styles.dot, { backgroundColor: n.color }]} />
      <AppText style={styles.name} numberOfLines={1}>
        {nameOf(n.id)}
      </AppText>
      <AppText style={styles.pct}>{pct(n.rial)}</AppText>
      <AppText style={styles.amount}>{money(n.rial)}</AppText>
    </View>
  );

  return (
    <GlassPanel radius={28} style={styles.panel}>
      <View style={styles.head}>
        <AppText style={styles.kicker}>{dict.moneyFlow.kicker}</AppText>
        <AppText style={styles.kicker}>{dict.moneyFlow.sub}</AppText>
      </View>
      <View style={{ height: HEIGHT }} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Canvas
            style={{ width, height: HEIGHT }}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants">
            <Group opacity={reveal}>
              {ribbons.map((r, i) => (
                <Path key={i} path={r.d} opacity={0.42}>
                  <LinearGradient start={vec(width, 0)} end={vec(0, 0)} colors={[r.from, r.to]} />
                </Path>
              ))}
            </Group>
            {sources.map(n => (
              <RoundedRect
                key={`s-${n.id}`}
                x={width - NODE_W}
                y={n.y}
                width={NODE_W}
                height={n.h}
                r={4}
                color={n.color}
              />
            ))}
            {sinks.map(n => (
              <RoundedRect
                key={`k-${n.id}`}
                x={0}
                y={n.y}
                width={NODE_W}
                height={n.h}
                r={4}
                color={n.color}
              />
            ))}
          </Canvas>
        ) : null}
      </View>
      <View style={styles.legend}>
        {sources.map(legendRow)}
        <View style={styles.divider} />
        {sinks.map(legendRow)}
      </View>
    </GlassPanel>
  );
}
