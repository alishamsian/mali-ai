import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../../components/ui/AppText';
import { GlassCard } from '../../../components/ui/GlassCard';
import { ArcGauge, Sparkline } from '../../../components/charts/Charts';
import { interpolate, t } from '../../../i18n';
import { formatTomanLabel } from '../../../utils/currency/money';
import { toPersianDigits } from '../../../utils/numbers/digits';
import type { ProIntel } from '../../../engine/insights/pro';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';

export function VaultHealthCard({
  intel,
  hidden,
  compact,
}: {
  intel: ProIntel;
  hidden?: boolean;
  compact?: boolean;
}) {
  const dict = t();
  const { colors } = useAppTheme();
  const styles = useThemedStyles((c, _t) => ({
    compact: { paddingVertical: 16 },
    heroRow: { flexDirection: 'row-reverse' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
    meta: { flex: 1, alignItems: 'flex-end' as const, paddingLeft: 8 },
    grade: { color: c.filament, marginVertical: 4 },
    scoreCaption: { color: c.textMuted, marginTop: 2 },
    paceTrack: { marginTop: 14 },
    paceHead: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginBottom: 8 },
    track: {
      height: 8,
      borderRadius: 8,
      backgroundColor: 'rgba(243,241,234,0.08)',
      overflow: 'hidden' as const,
    },
    expected: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(212,180,131,0.18)' },
    actual: { height: 8, borderRadius: 8 },
    week: { flexDirection: 'row-reverse' as const, alignItems: 'flex-end' as const, height: 72, gap: 6 },
    weekCol: { flex: 1, alignItems: 'center' as const, justifyContent: 'flex-end' as const, gap: 6 },
    weekBar: {
      width: '72%' as const,
      borderRadius: 5,
      backgroundColor: c.primary,
    },
  }));
  const paceOver = intel.paceRatio > 1.08;
  const maxWeek = Math.max(1, ...intel.weekdaySpend);
  const week = dict.insights.weekdays.split('');

  return (
    <GlassCard style={compact ? styles.compact : undefined}>
      <View style={styles.heroRow}>
        <View style={styles.meta}>
          <AppText variant="kicker">{dict.insights.vaultHealth}</AppText>
          <AppText variant="hero" style={styles.grade}>
            {toPersianDigits(intel.healthScore)}
          </AppText>
          <AppText variant="caption" style={styles.scoreCaption}>
            {dict.insights.score} {dict.insights.scoreOf100}
          </AppText>
          <AppText variant="kicker" style={{ marginTop: 8 }}>
            {dict.insights.vaultGrade}: {intel.grade}
          </AppText>
          <AppText variant="caption" style={{ marginTop: 10 }}>
            {hidden ? '••••' : formatTomanLabel(intel.forecastMonthExpenseRial)}
          </AppText>
          <AppText variant="kicker" style={{ marginTop: 6 }}>
            {dict.insights.forecast}
          </AppText>
        </View>
        <ArcGauge
          value={intel.healthScore}
          caption={dict.insights.scoreOf100}
          size={compact ? 108 : 128}
        />
      </View>
      <View style={styles.paceTrack}>
        <View style={styles.paceHead}>
          <AppText variant="caption" style={{ color: paceOver ? colors.expense : colors.income }}>
            {paceOver ? dict.insights.paceHot : dict.insights.paceCool}
          </AppText>
          <AppText variant="kicker">{dict.insights.pace}</AppText>
        </View>
        <View style={styles.track}>
          <View style={[styles.expected, { width: '100%' }]} />
          <View
            style={[
              styles.actual,
              {
                width: `${Math.min(100, intel.paceRatio * 80)}%`,
                backgroundColor: paceOver ? colors.expense : colors.primary,
              },
            ]}
          />
        </View>
      </View>
      {intel.runwayDays != null && !hidden ? (
        <AppText variant="caption" style={{ marginTop: 12, textAlign: 'right' }}>
          {interpolate(dict.insights.daysLeft, { n: toPersianDigits(intel.runwayDays) })}
        </AppText>
      ) : null}
      {!compact ? (
        <>
          <AppText variant="kicker" style={{ marginTop: 18, marginBottom: 8 }}>
            {dict.insights.burn14}
          </AppText>
          {intel.burnSeries.some(n => n > 0) ? (
            <Sparkline points={intel.burnSeries} color={colors.primary} width={280} height={56} />
          ) : (
            <AppText variant="caption">{dict.insights.empty}</AppText>
          )}
          <AppText variant="kicker" style={{ marginTop: 16, marginBottom: 8 }}>
            {dict.insights.weekPattern}
          </AppText>
          <View style={styles.week}>
            {intel.weekdaySpend.map((v, i) => (
              <View key={week[i] ?? i} style={styles.weekCol}>
                <View
                  style={[
                    styles.weekBar,
                    { height: Math.max(6, (v / maxWeek) * 48), opacity: 0.35 + (v / maxWeek) * 0.65 },
                  ]}
                />
                <AppText variant="kicker">{week[i]}</AppText>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </GlassCard>
  );
}
