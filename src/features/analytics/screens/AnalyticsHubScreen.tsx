import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { Screen } from '../../../components/ui/Screen';
import { AppText } from '../../../components/ui/AppText';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Skeleton } from '../../../components/ui/Skeleton';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainTabParamList, RootStackParamList } from '../../../app/navigation/types';
import { t } from '../../../i18n';
import { toJalaliMonthYear } from '../../../utils/dates/jalali';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useFinanceStore } from '../../../store/finance/store';
import { AnalyticsScreen } from './AnalyticsScreen';
import { CalendarScreen } from '../../insights/screens/CalendarScreen';
import { RecapScreen } from '../../insights/screens/RecapScreen';
import { InsightsScreen } from '../../insights/screens/InsightsScreen';

const SECTIONS = ['overview', 'calendar', 'recap', 'intel'] as const;
type Section = (typeof SECTIONS)[number];

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Analytics'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function AnalyticsHubScreen({ navigation: _navigation }: { navigation: Nav }) {
  const route = useRoute<RouteProp<MainTabParamList, 'Analytics'>>();
  const dict = t();
  const { colors } = useAppTheme();
  const hydrated = useFinanceStore(s => s.hydrated);
  const runSmsSync = useFinanceStore(s => s.runIncrementalSmsSync);
  const smsOn = useFinanceStore(s => s.snapshot.settings.smsProcessingEnabled);
  const [section, setSection] = useState<Section>(route.params?.section ?? 'overview');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (route.params?.section) {
      setSection(route.params.section);
    }
  }, [route.params?.section, route.params?.calendarDayKey]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (smsOn) {
        await runSmsSync();
      } else {
        await new Promise<void>(resolve => {
          setTimeout(resolve, 350);
        });
      }
    } finally {
      setRefreshing(false);
    }
  }, [runSmsSync, smsOn]);

  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
  );

  const styles = useThemedStyles((c, th) => ({
    header: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: th.spacing.lg,
      marginBottom: th.spacing.md,
      gap: th.spacing.sm,
    },
    titleBlock: { flex: 1, alignItems: 'flex-end', gap: 2 },
    brandTile: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    brandGlyph: { fontSize: 28, lineHeight: 40, fontFamily: th.typography.fontFamily.bold },
    title: { fontSize: 28, textAlign: 'right' },
    subtitle: { color: c.textMuted, textAlign: 'right' },
    body: { paddingHorizontal: 16, flex: 1, paddingBottom: 8 },
    skeletonWrap: { paddingHorizontal: th.spacing.lg, gap: 12, paddingTop: 4 },
    tabPane: { flex: 1 },
    tabHidden: { display: 'none' as const },
  }));

  if (!hydrated) {
    return (
      <Screen withTabBarInset>
        <View style={styles.header}>
          <View style={styles.titleBlock}>
            <AppText variant="title" style={styles.title}>
              {dict.nav.analytics}
            </AppText>
            <AppText variant="caption" style={styles.subtitle}>
              {dict.analyticsHub.subtitle}
            </AppText>
          </View>
        </View>
        <View style={styles.skeletonWrap}>
          <Skeleton height={40} radius={12} />
          <Skeleton height={220} radius={20} />
          <Skeleton height={160} radius={20} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen withTabBarInset>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <AppText variant="title" style={styles.title}>
            {dict.nav.analytics}
          </AppText>
          <AppText variant="caption" style={styles.subtitle}>
            {toJalaliMonthYear(new Date().toISOString())} · {dict.analyticsHub.subtitle}
          </AppText>
        </View>
        <View style={[styles.brandTile, { backgroundColor: colors.primary }]}>
          <AppText style={[styles.brandGlyph, { color: colors.onPrimary }]}>پ</AppText>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, marginBottom: 14 }}>
        <SegmentedControl
          options={[...SECTIONS]}
          value={section}
          onChange={setSection}
          labelFor={s => dict.analyticsHub[s]}
        />
      </View>

      <View style={[styles.body, { flex: 1 }]}>
        <View style={[styles.tabPane, section !== 'overview' && styles.tabHidden]}>
          <AnalyticsScreen embedded refreshControl={refreshControl} />
        </View>
        <View style={[styles.tabPane, section !== 'calendar' && styles.tabHidden]}>
          <CalendarScreen
            embedded
            initialDayKey={route.params?.calendarDayKey}
            refreshControl={refreshControl}
          />
        </View>
        <View style={[styles.tabPane, section !== 'recap' && styles.tabHidden]}>
          <RecapScreen embedded refreshControl={refreshControl} />
        </View>
        <View style={[styles.tabPane, section !== 'intel' && styles.tabHidden]}>
          <InsightsScreen embedded refreshControl={refreshControl} />
        </View>
      </View>
    </Screen>
  );
}
