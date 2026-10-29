import React, { useMemo } from 'react';
import { View } from 'react-native';
import { AppText } from '../../../components/ui/AppText';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { t, interpolate } from '../../../i18n';
import { useFinanceStore } from '../../../store/finance/store';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { formatTomanFromRial, formatCompactToman } from '../../../utils/currency/money';
import { toPersianDigits } from '../../../utils/numbers/digits';
import { DAY_BANDS, spendHeatmap, topMerchants } from '../../../engine/insights/habits';

/** Top merchants and a weekday × time-of-day heatmap, from the last 90 days. */
export function HabitsPanel({ hidden }: { hidden: boolean }) {
  const { colors, mode } = useAppTheme();
  const dict = t().habits;
  const transactions = useFinanceStore(s => s.snapshot.transactions);
  const { merchants, heat } = useMemo(() => {
    const now = new Date();
    return { merchants: topMerchants(transactions, now), heat: spendHeatmap(transactions, now) };
  }, [transactions]);
  const heatRgb = mode === 'light' ? '246,194,91' : '233,182,80';

  const styles = useThemedStyles((c, th) => ({
    panel: { padding: 18, gap: 12 },
    head: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'baseline' },
    kicker: { textAlign: 'right', color: c.textMuted, fontSize: 12 },
    row: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
    rank: {
      width: 28,
      height: 28,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.glassStrong,
    },
    rankText: { fontFamily: th.typography.fontFamily.semibold, color: c.text, fontSize: 12 },
    main: { flex: 1, gap: 2 },
    name: { textAlign: 'right', fontFamily: th.typography.fontFamily.semibold, color: c.text },
    sub: { textAlign: 'right', color: c.textMuted, fontSize: 12 },
    amount: { fontFamily: th.typography.fontFamily.semibold, color: c.text },
    grid: { gap: 4 },
    gridRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
    dayLabel: { width: 18, textAlign: 'center', color: c.textMuted, fontSize: 11 },
    cell: { flex: 1, height: 22, borderRadius: 6 },
    bandLabel: { flex: 1, textAlign: 'center', color: c.textMuted, fontSize: 11 },
    peak: { textAlign: 'right', color: c.text, fontSize: 13 },
  }));

  const money = (rial: number) => (hidden ? '••••' : formatTomanFromRial(rial));
  const peak = heat.peak;

  return (
    <>
      {merchants.length > 0 ? (
        <GlassPanel radius={28} style={styles.panel}>
          <View style={styles.head}>
            <AppText style={styles.kicker}>{dict.merchantsKicker}</AppText>
            <AppText style={styles.kicker}>{dict.merchantsSub}</AppText>
          </View>
          {merchants.map((m, i) => (
            <View key={m.name} style={styles.row}>
              <View style={styles.rank}>
                <AppText style={styles.rankText}>{toPersianDigits(i + 1)}</AppText>
              </View>
              <View style={styles.main}>
                <AppText style={styles.name} numberOfLines={1}>
                  {m.name}
                </AppText>
                <AppText style={styles.sub} numberOfLines={1}>
                  {[
                    interpolate(dict.perWeek, { n: toPersianDigits(m.perWeek) }),
                    interpolate(dict.avg, { amount: money(m.averageRial) }),
                  ].join(' · ')}
                </AppText>
              </View>
              <View style={{ alignItems: 'flex-start' }}>
                <AppText style={styles.amount}>{money(m.totalRial)}</AppText>
                <AppText style={styles.sub}>
                  {interpolate(dict.monthly, {
                    amount: hidden ? '••••' : formatCompactToman(m.monthlyRial),
                  })}
                </AppText>
              </View>
            </View>
          ))}
        </GlassPanel>
      ) : null}

      {peak ? (
        <GlassPanel radius={28} style={styles.panel}>
          <AppText style={styles.kicker}>{dict.heatKicker}</AppText>
          <AppText style={styles.peak}>
            {interpolate(dict.peak, { day: dict.days[peak.weekday], band: dict.bands[peak.band] })}
          </AppText>
          <View style={styles.grid}>
            <View style={styles.gridRow}>
              <View style={{ width: 18 }} />
              {dict.bands.slice(0, DAY_BANDS).map(b => (
                <AppText key={b} style={styles.bandLabel}>
                  {b}
                </AppText>
              ))}
            </View>
            {heat.cells.map((row, day) => (
              <View key={day} style={styles.gridRow}>
                <AppText style={styles.dayLabel}>{dict.daysShort[day]}</AppText>
                {row.map((value, band) => (
                  <View
                    key={band}
                    accessibilityLabel={`${dict.days[day]} ${dict.bands[band]}`}
                    style={[
                      styles.cell,
                      {
                        backgroundColor:
                          value > 0
                            ? `rgba(${heatRgb},${0.15 + (value / heat.maxRial) * 0.85})`
                            : colors.glass,
                      },
                    ]}
                  />
                ))}
              </View>
            ))}
          </View>
        </GlassPanel>
      ) : null}
    </>
  );
}
