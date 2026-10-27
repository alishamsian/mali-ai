import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '../../../components/ui/AppText';
import { DonutChart } from '../../../components/charts/Charts';
import { formatTomanFromRial } from '../../../utils/currency/money';
import { theme } from '../../../theme';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { t } from '../../../i18n';
import { toPersianDigits } from '../../../utils/numbers/digits';
import type { AllocationSlice } from '../engine/portfolio';
import { allocationColor } from '../catalog/classes';
import type { AllocationFilter } from '../../../types/wealth';

const FILTERS: AllocationFilter[] = ['all', 'investments', 'liquid', 'physical', 'alternative'];

export function AllocationPanel({
  slices,
  filter,
  onFilterChange,
  hidden,
}: {
  slices: AllocationSlice[];
  filter: AllocationFilter;
  onFilterChange: (f: AllocationFilter) => void;
  hidden: boolean;
}) {
  const dict = t();
  const { colors, mode } = useAppTheme();
  const isLight = mode === 'light';
  const panelBg = isLight ? colors.glass : 'rgba(255,255,255,0.035)';
  const chipBg = isLight ? 'rgba(8,13,16,0.04)' : 'rgba(255,255,255,0.05)';
  const styles = useThemedStyles((c, th) => ({
    wrap: {
      marginHorizontal: 16,
      marginBottom: 18,
      padding: 16,
      borderRadius: 24,
      backgroundColor: panelBg,
      borderWidth: 1,
      borderColor: isLight ? c.glassBorder : 'rgba(94,234,212,0.12)',
      overflow: 'hidden',
    },
    heading: {
      textAlign: 'right',
      alignSelf: 'stretch',
      fontFamily: th.typography.fontFamily.semibold,
      fontSize: 16,
      color: c.text,
      marginBottom: 4,
    },
    hint: {
      textAlign: 'right',
      alignSelf: 'stretch',
      fontSize: 12,
      color: c.textMuted,
      marginBottom: 12,
    },
    filters: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      gap: 6,
      marginBottom: 14,
    },
    filter: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: chipBg,
    },
    filterText: { fontSize: 11, color: c.textMuted, textAlign: 'center' },
    empty: {
      textAlign: 'center',
      alignSelf: 'stretch',
      color: c.textMuted,
      paddingVertical: 20,
    },
    body: { alignItems: 'center' },
    chartWrap: {
      width: 168,
      height: 168,
      alignItems: 'center',
      justifyContent: 'center',
    },
    center: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
    },
    centerPct: {
      fontSize: 22,
      fontFamily: th.typography.fontFamily.semibold,
      color: c.text,
      textAlign: 'center',
    },
    centerLabel: {
      fontSize: 11,
      color: c.textMuted,
      marginTop: 2,
      textAlign: 'center',
    },
    legend: { width: '100%', marginTop: 12, gap: 6 },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderRadius: 12,
    },
    legendOn: { backgroundColor: chipBg },
    swatch: { width: 8, height: 8, borderRadius: 4 },
    legendBody: { flex: 1, alignItems: 'flex-end', minWidth: 0 },
    legendName: {
      fontSize: 13,
      color: c.text,
      textAlign: 'right',
    },
    legendMeta: {
      fontSize: 11,
      color: c.textMuted,
      marginTop: 2,
      textAlign: 'right',
      writingDirection: 'ltr',
    },
    legendPct: {
      fontSize: 13,
      fontFamily: th.typography.fontFamily.semibold,
      color: c.text,
      minWidth: 40,
      textAlign: 'left',
      writingDirection: 'ltr',
    },
  }));
  const [selected, setSelected] = useState<string | null>(null);
  const active = slices.find(s => s.assetClass === selected) ?? slices[0];
  const chartSlices = useMemo(
    () => slices.map(s => ({ value: s.valueRial, color: allocationColor(s.assetClass, mode) })),
    [slices, mode],
  );

  return (
    <View style={styles.wrap}>
      <AppText style={styles.heading}>{dict.wealth.allocation}</AppText>
      <AppText style={styles.hint}>{dict.wealth.allocationHint}</AppText>
      <View style={styles.filters}>
        {FILTERS.map(f => (
          <Pressable
            key={f}
            onPress={() => onFilterChange(f)}
            style={[
              styles.filter,
              filter === f && {
                borderColor: colors.primary,
                backgroundColor: isLight ? colors.primary : theme.palette.primaryGlow,
              },
            ]}>
            <AppText
              style={[
                styles.filterText,
                filter === f && { color: isLight ? colors.onPrimary : colors.primary },
              ]}>
              {dict.wealth.allocationFilters[f]}
            </AppText>
          </Pressable>
        ))}
      </View>

      {slices.length === 0 ? (
        <AppText style={styles.empty}>{dict.wealth.allocationEmpty}</AppText>
      ) : (
        <View style={styles.body}>
          <View style={styles.chartWrap}>
            <DonutChart slices={chartSlices} size={168} />
            {active ? (
              <View style={styles.center} pointerEvents="none">
                <AppText style={styles.centerPct}>
                  {hidden ? '••' : `${toPersianDigits(active.percent.toFixed(0))}٪`}
                </AppText>
                <AppText style={styles.centerLabel} numberOfLines={1}>
                  {dict.wealth.classes[active.assetClass]}
                </AppText>
              </View>
            ) : null}
          </View>

          <View style={styles.legend}>
            {slices.map(s => {
              const on = active?.assetClass === s.assetClass;
              return (
                <Pressable
                  key={s.assetClass}
                  onPress={() => setSelected(s.assetClass)}
                  style={[styles.legendRow, on && styles.legendOn]}>
                  <AppText style={styles.legendPct}>
                    {hidden ? '••' : `${toPersianDigits(s.percent.toFixed(0))}٪`}
                  </AppText>
                  <View style={styles.legendBody}>
                    <AppText style={styles.legendName} numberOfLines={1}>
                      {dict.wealth.classes[s.assetClass]}
                    </AppText>
                    <AppText style={styles.legendMeta} numberOfLines={1}>
                      {hidden
                        ? '••••'
                        : `${formatTomanFromRial(s.valueRial)} · ${toPersianDigits(String(s.count))} ${dict.wealth.holdings}`}
                    </AppText>
                    {on && s.unrealizedPlRial !== 0 ? (
                      <AppText
                        style={{
                          color:
                            s.unrealizedPlRial >= 0 ? colors.income : colors.expense,
                          fontSize: 11,
                          marginTop: 2,
                          textAlign: 'right',
                        }}>
                        {dict.wealth.profit}:{' '}
                        {hidden ? '••' : formatTomanFromRial(s.unrealizedPlRial)}
                      </AppText>
                    ) : null}
                  </View>
                  <View
                    style={[styles.swatch, { backgroundColor: allocationColor(s.assetClass, mode) }]}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}
