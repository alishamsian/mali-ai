import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { AppText } from '../../../components/ui/AppText';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { t } from '../../../i18n';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { formatCompactToman } from '../../../utils/currency/money';
import { moneyFlow, type FlowNode } from '../../../engine/insights/moneyFlow';
import type { Transaction } from '../../../types/finance';

const HEIGHT = 220;
const GAP = 6;
const BAR = 8;
const LABEL_W = 92;

type Placed = FlowNode & { y: number; h: number };

function place(nodes: FlowNode[], total: number): Placed[] {
  const usable = HEIGHT - GAP * Math.max(0, nodes.length - 1);
  let y = 0;
  return nodes.map(n => {
    const h = Math.max(2, (n.rial / total) * usable);
    const placed = { ...n, y, h };
    y += h + GAP;
    return placed;
  });
}

const LABEL_H = 38;

/** Label tops centred on their bars but never overlapping, kept inside the chart. */
function labelTops(nodes: Placed[]): number[] {
  const tops: number[] = [];
  let floor = 0;
  for (const n of nodes) {
    const top = Math.max(floor, n.y + n.h / 2 - LABEL_H / 2);
    tops.push(top);
    floor = top + LABEL_H;
  }
  // Pushed past the bottom: slide the stack back up.
  let ceiling = HEIGHT;
  for (let i = tops.length - 1; i >= 0; i -= 1) {
    tops[i] = Math.max(0, Math.min(tops[i], ceiling - LABEL_H));
    ceiling = tops[i];
  }
  return tops;
}

/**
 * Sankey-style flow, right to left (RTL): income sources on the right, where the money
 * went on the left. Each source spreads over every sink in proportion, so band widths
 * read as shares of the month's money.
 */
export function MoneyFlowCard({
  transactions,
  hidden,
}: {
  transactions: Transaction[];
  hidden: boolean;
}) {
  const { colors, mode } = useAppTheme();
  const dict = t();
  const [width, setWidth] = useState(0);
  const flow = useMemo(() => moneyFlow(transactions), [transactions]);
  const styles = useThemedStyles((c, th) => ({
    panel: { padding: 18, gap: 12 },
    head: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'baseline' },
    kicker: { textAlign: 'right', color: c.textMuted, fontSize: 12 },
    stage: { height: HEIGHT, flexDirection: 'row-reverse' },
    labels: { width: LABEL_W, height: HEIGHT },
    label: { position: 'absolute', left: 0, right: 0, justifyContent: 'center' },
    name: { fontSize: 12, color: c.text, fontFamily: th.typography.fontFamily.semibold },
    value: { fontSize: 11, color: c.textMuted },
  }));
  if (!flow || flow.totalRial <= 0) {
    return null;
  }

  const sources = place(flow.sources, flow.totalRial);
  const sinks = place(flow.sinks, flow.totalRial);
  const nameOf = (id: FlowNode['id']) =>
    id === 'other'
      ? dict.moneyFlow.other
      : id === 'savings'
      ? dict.moneyFlow.savings
      : id === 'balance'
      ? dict.moneyFlow.balance
      : dict.categories[id];
  const sinkColor = (id: FlowNode['id']) =>
    id === 'savings' ? colors.income : id === 'other' ? colors.textMuted : colors.highlight;
  const bandOpacity = mode === 'light' ? 0.32 : 0.28;

  // Bands: source i → sink j carries source_i × sink_j / total.
  const bands: { d: string; color: string }[] = [];
  if (width > 0) {
    const x1 = width - BAR;
    const x0 = BAR;
    const mid = width / 2;
    const sinkCursor = sinks.map(s => s.y);
    for (const src of sources) {
      let srcCursor = src.y;
      sinks.forEach((sink, j) => {
        const share = (src.rial * sink.rial) / flow.totalRial / flow.totalRial;
        const hSrc = src.h * (sink.rial / flow.totalRial);
        const hSink = sink.h * (src.rial / flow.totalRial);
        if (share <= 0) {
          return;
        }
        const a = srcCursor;
        const b = sinkCursor[j];
        bands.push({
          d: `M${x1},${a} C${mid},${a} ${mid},${b} ${x0},${b} L${x0},${b + hSink} C${mid},${
            b + hSink
          } ${mid},${a + hSrc} ${x1},${a + hSrc} Z`,
          color: sinkColor(sink.id),
        });
        srcCursor += hSrc;
        sinkCursor[j] += hSink;
      });
    }
  }

  const labelColumn = (nodes: Placed[], align: 'right' | 'left') => {
    const tops = labelTops(nodes);
    return (
      <View style={styles.labels}>
        {nodes.map((n, i) => (
          <View key={n.id} style={[styles.label, { top: tops[i], height: LABEL_H }]}>
            <AppText style={[styles.name, { textAlign: align }]} numberOfLines={1}>
              {nameOf(n.id)}
            </AppText>
            <AppText style={[styles.value, { textAlign: align }]} numberOfLines={1}>
              {hidden ? '••••' : formatCompactToman(n.rial)}
            </AppText>
          </View>
        ))}
      </View>
    );
  };

  return (
    <GlassPanel radius={28} style={styles.panel}>
      <View style={styles.head}>
        <AppText style={styles.kicker}>{dict.moneyFlow.kicker}</AppText>
        <AppText style={styles.kicker}>{dict.moneyFlow.sub}</AppText>
      </View>
      <View style={styles.stage}>
        {labelColumn(sources, 'right')}
        <View style={{ flex: 1 }} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
          {width > 0 ? (
            <Svg width={width} height={HEIGHT}>
              {bands.map((band, i) => (
                <Path key={i} d={band.d} fill={band.color} opacity={bandOpacity} />
              ))}
              {sources.map(n => (
                <Rect
                  key={n.id}
                  x={width - BAR}
                  y={n.y}
                  width={BAR}
                  height={n.h}
                  rx={3}
                  fill={n.id === 'balance' ? colors.textMuted : colors.primary}
                />
              ))}
              {sinks.map(n => (
                <Rect
                  key={n.id}
                  x={0}
                  y={n.y}
                  width={BAR}
                  height={n.h}
                  rx={3}
                  fill={sinkColor(n.id)}
                />
              ))}
            </Svg>
          ) : null}
        </View>
        {labelColumn(sinks, 'left')}
      </View>
    </GlassPanel>
  );
}
