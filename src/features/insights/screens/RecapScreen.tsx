import React, { useMemo } from 'react';
import { ScrollView, Share, View, type RefreshControlProps } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppText } from '../../../components/ui/AppText';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { GlassCard } from '../../../components/ui/GlassCard';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { interpolate, t } from '../../../i18n';
import { formatTomanLabel } from '../../../utils/currency/money';
import { toJalaliMonthYear } from '../../../utils/dates/jalali';
import { useFinanceStore, selectMonthStats } from '../../../store/finance/store';
import { buildProIntel } from '../../../engine/insights/pro';
import { buildRecapShareMessage } from '../../../engine/insights/recapShare';
import { financialMonthTransactions } from '../../../engine/insights/monthPeriod';
import { hapticSuccess } from '../../../utils/haptics';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import type { MainTabParamList, RootStackParamList } from '../../../app/navigation/types';

const HERO_GRADIENT_DARK = ['#121A16', '#0C1418', '#081018'] as const;
const HERO_GRADIENT_LIGHT = ['#E8F4F1', '#EEF2F4', '#F2F5F6'] as const;

type RecapNav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Analytics'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function RecapScreen({
  embedded = false,
  refreshControl,
}: {
  embedded?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
} = {}) {
  const navigation = useNavigation<RecapNav>();
  const insets = useSafeAreaInsets();
  const snapshot = useFinanceStore(s => s.snapshot);
  const hidden = snapshot.settings.hideBalances;
  const stats = selectMonthStats(snapshot);
  const dict = t();
  const { mode } = useAppTheme();
  const isLight = mode === 'light';
  const heroColors = isLight ? [...HERO_GRADIENT_LIGHT] : [...HERO_GRADIENT_DARK];
  const heroBorder = isLight ? 'rgba(18,155,134,0.22)' : 'rgba(212,180,131,0.2)';
  const mask = (value: string) => (hidden ? '••••' : value);
  const total = snapshot.accounts.reduce((s, a) => s + a.balanceRial, 0);
  const monthTx = useMemo(() => financialMonthTransactions(snapshot), [snapshot.transactions, snapshot.settings]);
  const intel = useMemo(
    () => buildProIntel(snapshot.transactions, total, new Date(), snapshot),
    [snapshot.transactions, snapshot.settings, total],
  );
  const period = toJalaliMonthYear(new Date().toISOString());
  const report = buildRecapShareMessage(dict, intel, stats, total, hidden, period);

  const styles = useThemedStyles((c, _t) => ({
    hero: {
      minHeight: 188,
      padding: 22,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 8,
      borderBottomRightRadius: 28,
      borderBottomLeftRadius: 28,
      borderWidth: 1,
      borderColor: heroBorder,
      overflow: 'hidden' as const,
    },
    heroRow: {
      flexDirection: 'row-reverse' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'flex-end' as const,
      marginTop: 8,
    },
    grade: { color: c.filament },
    row: { flexDirection: 'row-reverse' as const, justifyContent: 'space-between' as const, paddingVertical: 10 },
  }));

  const body = (
    <ScrollView
      contentContainerStyle={{
        paddingTop: embedded ? 0 : insets.top + 16,
        padding: embedded ? 0 : 20,
        gap: 12,
        paddingBottom: embedded ? 8 : 40,
      }}
      nestedScrollEnabled={embedded}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}>
      {!embedded ? (
        <>
          <AppText variant="kicker" style={{ textAlign: 'center' }}>
            {period}
          </AppText>
          <AppText variant="title" style={{ textAlign: 'center' }}>
            {dict.insights.recap}
          </AppText>
        </>
      ) : null}
      {monthTx.length === 0 ? (
        <EmptyState
          title={dict.insights.recapEmpty}
          actionLabel={dict.insights.recapEmptyAction}
          onAction={() => navigation.navigate('AddTransaction', {})}
        />
      ) : (
        <>
          <LinearGradient
            colors={heroColors}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.hero}>
            <AppText variant="kicker">{dict.insights.vaultHealth}</AppText>
            <View style={styles.heroRow}>
              <View>
                <AppText variant="caption">{dict.dashboard.savings}</AppText>
                <AppText variant="title">{mask(formatTomanLabel(stats.savingsRial))}</AppText>
              </View>
              <AppText variant="display" style={styles.grade}>
                {intel.grade}
              </AppText>
            </View>
            <AppText variant="caption" style={{ marginTop: 12 }}>
              {intel.paceRatio > 1.08 ? dict.insights.paceHot : dict.insights.paceCool}
            </AppText>
          </LinearGradient>
          <GlassCard>
            <Row k={dict.dashboard.income} v={mask(formatTomanLabel(stats.incomeRial))} />
            <Row k={dict.dashboard.expense} v={mask(formatTomanLabel(stats.expenseRial))} />
            <Row k={dict.insights.forecast} v={mask(formatTomanLabel(intel.forecastMonthExpenseRial))} />
            <Row
              k={dict.insights.envelope}
              v={mask(formatTomanLabel(intel.envelopeLeftRial, { sign: true }))}
            />
            <Row k={dict.dashboard.totalBalance} v={mask(formatTomanLabel(total))} />
            {intel.runwayDays != null ? (
              <Row
                k={dict.insights.runway}
                v={hidden ? '••••' : interpolate(dict.insights.days, { n: intel.runwayDays })}
              />
            ) : null}
          </GlassCard>
          <PrimaryButton
            label={dict.insights.share}
            onPress={() => {
              hapticSuccess();
              void Share.share({ message: report, title: dict.insights.recap });
            }}
          />
        </>
      )}
    </ScrollView>
  );

  if (embedded) {
    return body;
  }
  return <NightCanvas>{body}</NightCanvas>;
}

function Row({ k, v }: { k: string; v: string }) {
  const styles = useThemedStyles((_c, _t) => ({
    row: { flexDirection: 'row-reverse' as const, justifyContent: 'space-between' as const, paddingVertical: 10 },
  }));
  return (
    <View style={styles.row}>
      <AppText>{v}</AppText>
      <AppText variant="caption">{k}</AppText>
    </View>
  );
}
