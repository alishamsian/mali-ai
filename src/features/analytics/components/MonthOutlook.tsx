import React, { useMemo } from 'react';
import { View } from 'react-native';
import { AppText } from '../../../components/ui/AppText';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { categoryIcons } from '../../../components/lists/TransactionRow';
import { t, interpolate } from '../../../i18n';
import { useFinanceStore } from '../../../store/finance/store';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { formatTomanFromRial, formatCompactToman, displayUnitLabel } from '../../../utils/currency/money';
import { toPersianDigits } from '../../../utils/numbers/digits';
import { changeBreakdown, monthForecast } from '../../../engine/insights/forecast';
import { upcomingDues } from '../../../engine/obligations/dues';
import { realMonthOverMonth } from '../../../engine/insights/inflation';

/** Below this the forecast is noise: a few days of data in a brand-new app. */
const MIN_SPENT_RIAL = 10_000;

const pct = (n: number) => toPersianDigits(Math.round(Math.abs(n)));

/** Month-end forecast plus "why is this month different", for the analytics tab. */
export function MonthOutlook({ hidden }: { hidden: boolean }) {
  const { colors } = useAppTheme();
  const dict = t().outlook;
  const categoryNames = t().categories;
  const transactions = useFinanceStore(s => s.snapshot.transactions);
  const budgetCategories = useFinanceStore(s => s.snapshot.budgetCategories);
  const plans = useFinanceStore(s => s.snapshot.installmentPlans);
  const cheques = useFinanceStore(s => s.snapshot.cheques);
  const debts = useFinanceStore(s => s.snapshot.debts);
  const calendar = useFinanceStore(s => s.snapshot.settings.calendar) ?? 'jalali';
  const startDay = useFinanceStore(s => s.snapshot.settings.financialMonthStartDay);
  const monthSettings = useMemo(
    () => ({ calendar, financialMonthStartDay: startDay }),
    [calendar, startDay],
  );
  const inflationPct = useFinanceStore(s => s.snapshot.settings.annualInflationPct) ?? 35;

  const { forecast, breakdown, budgetRial } = useMemo(() => {
    const now = new Date();
    const first = monthForecast(transactions, now, 0, monthSettings);
    const daysLeft = first.daysInMonth - first.day;
    const scheduled = upcomingDues({ plans, cheques, debts }, now, daysLeft, calendar)
      .filter(d => d.flow === 'out')
      .reduce((s, d) => s + d.amountRial, 0);
    return {
      forecast: monthForecast(transactions, now, scheduled, monthSettings),
      breakdown: changeBreakdown(transactions, now, 5, monthSettings),
      budgetRial: budgetCategories.reduce((s, c) => s + (c.limitRial > 0 ? c.limitRial : 0), 0),
    };
  }, [transactions, budgetCategories, plans, cheques, debts, calendar, monthSettings]);

  const styles = useThemedStyles((c, th) => ({
    panel: { padding: 18, gap: 10 },
    kicker: { textAlign: 'right', color: c.textMuted, fontSize: 12 },
    big: {
      textAlign: 'right',
      fontSize: 28,
      fontFamily: th.typography.fontFamily.bold,
      color: c.text,
    },
    sub: { textAlign: 'right', color: c.textSecondary, fontSize: 12 },
    row: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
    chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
    chipText: { fontSize: 12, fontFamily: th.typography.fontFamily.semibold },
    bar: {
      height: 12,
      borderRadius: 6,
      backgroundColor: c.glassBorder,
      flexDirection: 'row-reverse',
      overflow: 'hidden',
    },
    marker: {
      position: 'absolute',
      top: -4,
      bottom: -4,
      width: 2,
      borderRadius: 1,
      backgroundColor: c.text,
    },
    legend: { flexDirection: 'row-reverse', gap: 14 },
    legendItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
    swatch: { width: 10, height: 10, borderRadius: 3 },
    whyRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, minHeight: 34 },
    whyName: { width: 92, textAlign: 'right', color: c.text, fontSize: 13 },
    whyTrack: { flex: 1, height: 10, flexDirection: 'row' },
    half: { flex: 1, flexDirection: 'row' },
    whyAmount: {
      width: 92,
      textAlign: 'left',
      fontSize: 12,
      fontFamily: th.typography.fontFamily.semibold,
    },
  }));

  const money = (rial: number) => (hidden ? '••••' : formatTomanFromRial(rial));
  if (forecast.spentRial < MIN_SPENT_RIAL) {
    return null;
  }

  const scale = Math.max(forecast.highRial, budgetRial, forecast.lastMonthRial, 1);
  const spentShare = forecast.spentRial / scale;
  const aheadShare = Math.max(0, forecast.projectedRial - forecast.spentRial) / scale;
  const reference = budgetRial > 0 ? budgetRial : forecast.lastMonthRial;
  const vsRef = reference > 0 ? ((forecast.projectedRial - reference) / reference) * 100 : null;
  const verdict =
    vsRef == null
      ? null
      : budgetRial > 0
      ? vsRef > 0
        ? { text: interpolate(dict.overBudget, { pct: pct(vsRef) }), warn: true }
        : { text: dict.withinBudget, warn: false }
      : {
          text: interpolate(vsRef > 0 ? dict.moreThanLast : dict.lessThanLast, { pct: pct(vsRef) }),
          warn: vsRef > 0,
        };

  // Projected month vs last month after removing a month of inflation.
  const real = realMonthOverMonth(forecast.projectedRial, forecast.lastMonthRial, inflationPct);
  const realLine =
    real && Math.abs(real.realPct) >= 1
      ? interpolate(dict.realChange, {
          pct: toPersianDigits(inflationPct),
          change: interpolate(real.realPct > 0 ? dict.realMore : dict.realLess, {
            pct: pct(real.realPct),
          }),
        })
      : null;

  const maxDelta = Math.max(1, ...breakdown.rows.map(r => Math.abs(r.deltaRial)));
  const summary =
    Math.abs(breakdown.deltaRial) < breakdown.previousRial * 0.03
      ? dict.whySame
      : interpolate(breakdown.deltaRial > 0 ? dict.whyMore : dict.whyLess, {
          amount: money(Math.abs(breakdown.deltaRial)),
        });

  return (
    <>
      <GlassPanel radius={28} style={styles.panel}>
        <View style={styles.row}>
          <AppText style={styles.kicker}>{dict.forecastKicker}</AppText>
          {verdict && !hidden ? (
            <View
              style={[
                styles.chip,
                { backgroundColor: verdict.warn ? colors.highlight : colors.glassStrong },
              ]}>
              <AppText
                style={[
                  styles.chipText,
                  { color: verdict.warn ? colors.onHighlight : colors.income },
                ]}>
                {verdict.text}
              </AppText>
            </View>
          ) : null}
        </View>
        <AppText style={styles.big}>{`${money(forecast.projectedRial)} ${
          displayUnitLabel()
        }`}</AppText>
        {hidden ? null : (
          <AppText style={styles.sub}>
            {interpolate(dict.range, {
              low: formatCompactToman(forecast.lowRial),
              high: formatCompactToman(forecast.highRial),
            })}
          </AppText>
        )}
        <View>
          <View style={styles.bar}>
            <View style={{ width: `${spentShare * 100}%`, backgroundColor: colors.primary }} />
            <View style={{ width: `${aheadShare * 100}%`, backgroundColor: colors.highlight }} />
          </View>
          {budgetRial > 0 ? (
            <View style={[styles.marker, { right: `${(budgetRial / scale) * 100}%` }]} />
          ) : null}
        </View>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: colors.primary }]} />
            <AppText style={styles.sub}>{`${dict.legendSpent} ${money(
              forecast.spentRial,
            )}`}</AppText>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: colors.highlight }]} />
            <AppText style={styles.sub}>{dict.legendAhead}</AppText>
          </View>
          {budgetRial > 0 ? (
            <View style={styles.legendItem}>
              <View style={[styles.swatch, { width: 2, backgroundColor: colors.text }]} />
              <AppText style={styles.sub}>{dict.legendBudget}</AppText>
            </View>
          ) : null}
        </View>
        <AppText style={styles.sub}>
          {[
            interpolate(dict.dayOf, {
              day: toPersianDigits(forecast.day),
              days: toPersianDigits(forecast.daysInMonth),
            }),
            forecast.lastMonthRial > 0
              ? interpolate(dict.lastMonth, { amount: money(forecast.lastMonthRial) })
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </AppText>
        {realLine && !hidden ? <AppText style={styles.sub}>{realLine}</AppText> : null}
        {forecast.scheduledRial > 0 && !hidden ? (
          <AppText style={styles.sub}>
            {interpolate(dict.scheduled, { amount: money(forecast.scheduledRial) })}
          </AppText>
        ) : null}
      </GlassPanel>

      {breakdown.rows.length > 0 ? (
        <GlassPanel radius={28} style={styles.panel}>
          <AppText style={styles.kicker}>{dict.whyKicker}</AppText>
          <AppText style={[styles.sub, { color: colors.text, fontSize: 14 }]}>{summary}</AppText>
          {breakdown.rows.map(row => {
            const Icon = categoryIcons[row.id];
            const up = row.deltaRial > 0;
            const width = `${(Math.abs(row.deltaRial) / maxDelta) * 100}%` as const;
            const tone = up ? colors.text : colors.income;
            return (
              <View key={row.id} style={styles.whyRow}>
                {Icon ? <Icon size={16} color={colors.textSecondary} /> : null}
                <AppText style={styles.whyName} numberOfLines={1}>
                  {categoryNames[row.id]}
                </AppText>
                {/* Diverging bar: increases grow left of the centre line, decreases right. */}
                <View style={styles.whyTrack}>
                  <View style={[styles.half, { justifyContent: 'flex-end' }]}>
                    {up ? (
                      <View style={{ width, borderRadius: 5, backgroundColor: colors.highlight }} />
                    ) : null}
                  </View>
                  <View style={{ width: 1, backgroundColor: colors.textMuted }} />
                  <View style={styles.half}>
                    {up ? null : (
                      <View
                        style={{
                          width,
                          borderRadius: 5,
                          backgroundColor: colors.income,
                          opacity: 0.6,
                        }}
                      />
                    )}
                  </View>
                </View>
                <AppText style={[styles.whyAmount, { color: tone }]}>
                  {hidden
                    ? '••••'
                    : `${up ? '▲' : '▼'} ${formatCompactToman(Math.abs(row.deltaRial))}`}
                </AppText>
              </View>
            );
          })}
        </GlassPanel>
      ) : null}
    </>
  );
}
