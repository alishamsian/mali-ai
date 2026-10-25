import React, { useMemo } from 'react';
import { ScrollView, View, type RefreshControlProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppText } from '../../../components/ui/AppText';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { GlassCard } from '../../../components/ui/GlassCard';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { PressScale } from '../../../components/ui/PressScale';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { interpolate, t } from '../../../i18n';
import { formatTomanLabel } from '../../../utils/currency/money';
import { useFinanceStore } from '../../../store/finance/store';
import { buildProIntel } from '../../../engine/insights/pro';
import { financialMonthTransactions } from '../../../engine/insights/monthPeriod';
import { recurringFromTransactions, recurringId } from '../../../engine/recurring/detect';
import { VaultHealthCard } from '../components/VaultHealthCard';
import type { MainTabParamList, RootStackParamList } from '../../../app/navigation/types';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { hapticSuccess } from '../../../utils/haptics';

type InsightsNav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Analytics'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function InsightsScreen({
  navigation: navigationProp,
  embedded = false,
  refreshControl,
}: {
  navigation?: InsightsNav;
  embedded?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
} = {}) {
  const insets = useSafeAreaInsets();
  const navigation = navigationProp ?? useNavigation<InsightsNav>();
  const { colors } = useAppTheme();
  const styles = useThemedStyles((c, _t) => ({
    stats: { flexDirection: 'row-reverse' as const, gap: 10 },
    stat: { flex: 1 },
    line: { marginTop: 14, gap: 4 },
    lineTop: {
      flexDirection: 'row-reverse' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
    },
    lineActions: {
      flexDirection: 'row-reverse' as const,
      alignItems: 'center' as const,
      gap: 12,
      marginTop: 6,
    },
    pinBtn: { paddingVertical: 4 },
    pinDone: { color: c.textMuted },
    pinLink: { color: c.primary },
    settingsLink: {
      width: '100%' as const,
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      backgroundColor: c.surfaceSolid,
      paddingHorizontal: 8,
      marginTop: 12,
    },
    severityHigh: { color: c.expense },
    severityWatch: { color: c.textSecondary },
  }));
  const snapshot = useFinanceStore(s => s.snapshot);
  const upsertRecurring = useFinanceStore(s => s.upsertRecurring);
  const hidden = snapshot.settings.hideBalances;
  const dict = t();
  const insightsOn = snapshot.settings.insightsEnabled !== false;
  const total = snapshot.accounts.reduce((s, a) => s + a.balanceRial, 0);
  const monthTx = useMemo(() => financialMonthTransactions(snapshot), [snapshot.transactions, snapshot.settings]);
  const intel = useMemo(
    () => buildProIntel(snapshot.transactions, total, new Date(), snapshot),
    [snapshot.transactions, snapshot.settings, total],
  );
  const pinnedIds = useMemo(
    () => new Set(snapshot.recurring.map(item => item.id)),
    [snapshot.recurring],
  );
  const mask = (value: string) => (hidden ? '••••' : value);

  const pinHint = (merchant: string, amountRial: number, avgGapDays: number, nextDueIso: string) => {
    upsertRecurring(
      recurringFromTransactions(
        merchant,
        amountRial,
        snapshot.profile.id,
        avgGapDays,
        nextDueIso,
      ),
    );
    hapticSuccess();
  };

  const body = (
    <ScrollView
      contentContainerStyle={{
        paddingTop: embedded ? 0 : insets.top + 8,
        padding: embedded ? 0 : 20,
        gap: 12,
        paddingBottom: embedded ? 8 : 40,
      }}
      nestedScrollEnabled={embedded}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}>
      {!embedded ? (
        <ScreenHeader
          title={dict.insights.title}
          subtitle={dict.dashboard.intelligence}
          onBack={() => navigation.goBack()}
        />
      ) : null}
      {!insightsOn ? (
        <GlassCard>
          <AppText style={{ textAlign: 'right' }}>{dict.settings.insightsDisabledBody}</AppText>
          <PressScale
            onPress={() => navigation.navigate('SettingsInsights')}
            style={styles.settingsLink}>
            <AppText variant="body">{dict.settings.categories.insights}</AppText>
          </PressScale>
        </GlassCard>
      ) : null}
      {insightsOn && monthTx.length === 0 ? (
        <EmptyState
          title={dict.insights.empty}
          actionLabel={dict.insights.recapEmptyAction}
          onAction={() => navigation.navigate('AddTransaction', {})}
        />
      ) : null}
      {insightsOn && monthTx.length > 0 ? <VaultHealthCard intel={intel} hidden={hidden} /> : null}
      {insightsOn && monthTx.length > 0 ? (
        <>
          <View style={styles.stats}>
            <GlassCard style={styles.stat}>
              <AppText variant="kicker">{dict.insights.envelope}</AppText>
              <AppText
                variant="title"
                style={{
                  color: intel.envelopeLeftRial >= 0 ? colors.income : colors.expense,
                }}>
                {mask(formatTomanLabel(intel.envelopeLeftRial, { sign: true }))}
              </AppText>
              <AppText variant="caption" style={{ marginTop: 6 }}>
                {interpolate(dict.insights.savingsPct, { n: Math.round(intel.savingsRate * 100) })}
              </AppText>
            </GlassCard>
            <GlassCard style={styles.stat}>
              <AppText variant="kicker">{dict.insights.burn}</AppText>
              <AppText variant="title">{mask(formatTomanLabel(intel.burnPerDayRial))}</AppText>
              {intel.topCategoryId ? (
                <AppText variant="caption" style={{ marginTop: 6 }}>
                  {dict.insights.concentration} · {dict.categories[intel.topCategoryId]}{' '}
                  {Math.round(intel.topCategoryShare * 100)}٪
                </AppText>
              ) : null}
            </GlassCard>
          </View>
          <GlassCard>
            <AppText variant="kicker">{dict.insights.recurring}</AppText>
            {intel.recurring.length === 0 ? (
              <AppText variant="caption" style={{ marginTop: 8 }}>
                {dict.insights.noRecurring}
              </AppText>
            ) : (
              intel.recurring.slice(0, 4).map(r => {
                const id = recurringId(r.merchant, r.amountRial);
                const pinned = pinnedIds.has(id);
                return (
                  <View key={id} style={styles.line}>
                    <View style={styles.lineTop}>
                      <AppText>{mask(formatTomanLabel(r.amountRial))}</AppText>
                      <AppText variant="kicker">
                        {r.daysUntil < 0
                          ? dict.insights.overdue
                          : interpolate(dict.insights.dueIn, { n: r.daysUntil })}
                      </AppText>
                    </View>
                    <AppText variant="caption">{r.merchant}</AppText>
                    <View style={styles.lineActions}>
                      {pinned ? (
                        <>
                          <AppText variant="caption" style={styles.pinDone}>
                            {dict.insights.pinnedRecurring}
                          </AppText>
                          <PressScale
                            onPress={() => navigation.navigate('Budgets', { section: 'bills' })}
                            style={styles.pinBtn}>
                            <AppText variant="caption" style={styles.pinLink}>
                              {dict.insights.viewBills}
                            </AppText>
                          </PressScale>
                        </>
                      ) : (
                        <PressScale
                          onPress={() => pinHint(r.merchant, r.amountRial, r.avgGapDays, r.nextDueIso)}
                          style={styles.pinBtn}>
                          <AppText variant="caption" style={styles.pinLink}>
                            {dict.insights.pinRecurring}
                          </AppText>
                        </PressScale>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </GlassCard>
          <GlassCard>
            <AppText variant="kicker">{dict.insights.anomaly}</AppText>
            {intel.anomalies.length === 0 ? (
              <AppText variant="caption" style={{ marginTop: 8 }}>
                {dict.insights.noAnomaly}
              </AppText>
            ) : (
              intel.anomalies.slice(0, 3).map(a => (
                <View key={a.id} style={styles.line}>
                  <View style={styles.lineTop}>
                    <AppText>{mask(formatTomanLabel(a.amountRial))}</AppText>
                    <AppText
                      variant="caption"
                      style={a.severity === 'high' ? styles.severityHigh : styles.severityWatch}>
                      {a.severity === 'high' ? dict.insights.severityHigh : dict.insights.severityWatch}
                    </AppText>
                  </View>
                  <AppText variant="caption">{a.merchant}</AppText>
                </View>
              ))
            )}
          </GlassCard>
        </>
      ) : null}
    </ScrollView>
  );

  if (embedded) {
    return body;
  }
  return <NightCanvas>{body}</NightCanvas>;
}
