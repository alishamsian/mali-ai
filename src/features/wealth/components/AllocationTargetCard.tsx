import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '../../../components/ui/AppText';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { appAlert } from '../../../components/ui/AppAlert';
import { t, interpolate } from '../../../i18n';
import { useFinanceStore } from '../../../store/finance/store';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { toPersianDigits } from '../../../utils/numbers/digits';
import { allocationVsTarget, PRESETS, type TargetPreset } from '../engine/targets';

/** Drift under this many points counts as on target. */
const TOLERANCE_PCT = 3;

/** Current mix per bucket against a chosen target preset, with how far each one drifts. */
export function AllocationTargetCard({ embedded = false }: { embedded?: boolean }) {
  const { colors } = useAppTheme();
  const dict = t().wealth;
  const accounts = useFinanceStore(s => s.snapshot.accounts);
  const targets = useFinanceStore(s => s.snapshot.settings.allocationTargets);
  const rows = useMemo(
    () => (targets ? allocationVsTarget(accounts, targets) : []),
    [accounts, targets],
  );

  const styles = useThemedStyles((c, th) => ({
    panel: { padding: 18, gap: 12 },
    embedded: { backgroundColor: 'transparent', borderWidth: 0, padding: 0, marginTop: 16 },
    head: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
    title: { textAlign: 'right', color: c.text, fontFamily: th.typography.fontFamily.semibold },
    link: { color: c.textMuted, fontSize: 12 },
    hint: { textAlign: 'right', color: c.textMuted, fontSize: 12 },
    row: { gap: 6 },
    rowHead: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
    name: { color: c.text, fontSize: 13 },
    track: {
      height: 8,
      borderRadius: 4,
      backgroundColor: c.glassBorder,
      flexDirection: 'row-reverse',
    },
    marker: {
      position: 'absolute',
      top: -3,
      bottom: -3,
      width: 2,
      backgroundColor: c.text,
      borderRadius: 1,
    },
  }));

  const pick = () =>
    appAlert(dict.targetsPick, dict.targetsHint, [
      ...(Object.keys(PRESETS) as TargetPreset[]).map(preset => ({
        text: dict.presets[preset],
        onPress: () =>
          useFinanceStore.getState().updateSettings({ allocationTargets: PRESETS[preset] }),
      })),
      ...(targets
        ? [
            {
              text: dict.targetsClear,
              style: 'destructive' as const,
              onPress: () =>
                useFinanceStore.getState().updateSettings({ allocationTargets: undefined }),
            },
          ]
        : []),
      { text: t().common.cancel, style: 'cancel' as const },
    ]);

  return (
    <GlassPanel radius={28} style={[styles.panel, embedded && styles.embedded]}>
      <View style={styles.head}>
        <AppText style={styles.title}>{dict.targetsTitle}</AppText>
        <Pressable onPress={pick} accessibilityRole="button" hitSlop={8}>
          <AppText style={styles.link}>{dict.targetsPick}</AppText>
        </Pressable>
      </View>
      {rows.length === 0 ? <AppText style={styles.hint}>{dict.targetsHint}</AppText> : null}
      {rows.map(row => {
        const off = Math.abs(row.driftPct) > TOLERANCE_PCT;
        return (
          <View key={row.bucket} style={styles.row}>
            <View style={styles.rowHead}>
              <AppText style={styles.name}>
                {`${dict.buckets[row.bucket]} · ${toPersianDigits(
                  Math.round(row.currentPct),
                )}٪ از ${toPersianDigits(row.targetPct)}٪`}
              </AppText>
              <AppText style={[styles.link, off && { color: colors.warning }]}>
                {off
                  ? interpolate(row.driftPct > 0 ? dict.driftAbove : dict.driftBelow, {
                      n: Math.round(Math.abs(row.driftPct)),
                    })
                  : dict.onTarget}
              </AppText>
            </View>
            <View style={styles.track}>
              <View
                style={{
                  width: `${Math.min(100, row.currentPct)}%`,
                  borderRadius: 4,
                  backgroundColor: off ? colors.highlight : colors.income,
                }}
              />
              <View style={[styles.marker, { right: `${Math.min(100, row.targetPct)}%` }]} />
            </View>
          </View>
        );
      })}
    </GlassPanel>
  );
}
