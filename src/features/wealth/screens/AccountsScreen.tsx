import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Plus } from 'lucide-react-native';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { AppText } from '../../../components/ui/AppText';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { AlertBanner } from '../../../components/ui/AlertBanner';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { Skeleton } from '../../../components/ui/Skeleton';
import { t } from '../../../i18n';
import { formatTomanFromRial } from '../../../utils/currency/money';
import { useFinanceStore } from '../../../store/finance/store';
import type { RootStackParamList } from '../../../app/navigation/types';
import type { AllocationFilter, AssetClass, WealthRange } from '../../../types/wealth';
import {
  buildAllocation,
  filterAndSortHoldings,
  filterNetWorthHistory,
  netWorthChangePct,
  summarizePortfolio,
  type WealthSort,
} from '../engine/portfolio';
import { supportsLivePrice } from '../pricing/symbols';
import { NetWorthHero } from '../components/NetWorthHero';
import { AllocationPanel } from '../components/AllocationPanel';
import { WealthHoldingCard } from '../components/WealthHoldingCard';
import { ASSET_CLASS_ORDER } from '../catalog/classes';

export function AccountsScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const snapshot = useFinanceStore(s => s.snapshot);
  const hydrated = useFinanceStore(s => s.hydrated);
  const refreshWealthPrices = useFinanceStore(s => s.refreshWealthPrices);
  const { colors, mode, accent } = useAppTheme();
  const isLight = mode === 'light';
  const chipBg = isLight ? 'rgba(8,13,16,0.04)' : 'rgba(255,255,255,0.04)';
  const panelBg = isLight ? colors.surfaceSolid : 'rgba(255,255,255,0.035)';

  const [refreshing, setRefreshing] = useState(false);
  const [priceError, setPriceError] = useState(false);

  const styles = useThemedStyles((c, th) => ({
    screen: { flex: 1, backgroundColor: 'transparent' },
    skeletonWrap: { paddingHorizontal: 16, gap: 12, paddingTop: 8 },
    topBar: {
      flexDirection: 'row-reverse',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginBottom: 8,
      gap: 12,
    },
    screenTitle: {
      flex: 1,
      fontSize: 22,
      fontFamily: th.typography.fontFamily.semibold,
      color: c.text,
      textAlign: 'right',
    },
    screenSubtitle: {
      textAlign: 'right' as const,
      paddingHorizontal: 16,
      marginBottom: 6,
      color: c.textMuted,
    },
    addBtn: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 14,
      borderWidth: 1,
    },
    addBtnText: { fontSize: 13, textAlign: 'center' },
    refreshRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: 16,
      marginBottom: 10,
    },
    perfRow: {
      flexDirection: 'row-reverse',
      gap: 10,
      paddingHorizontal: 16,
      marginBottom: 14,
    },
    perfCard: {
      flex: 1,
      borderRadius: 16,
      padding: 12,
      backgroundColor: panelBg,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
    },
    perfLabel: {
      fontSize: 11,
      color: c.textMuted,
      marginBottom: 4,
      textAlign: 'center',
    },
    perfValue: {
      fontSize: 13,
      fontFamily: th.typography.fontFamily.semibold,
      color: c.text,
      textAlign: 'center',
      writingDirection: 'ltr',
    },
    listHeader: { paddingHorizontal: 16, marginBottom: 8, marginTop: 4 },
    listTitle: {
      textAlign: 'right',
      alignSelf: 'stretch',
      fontFamily: th.typography.fontFamily.semibold,
      fontSize: 16,
      color: c.text,
      marginBottom: 2,
    },
    listHint: {
      textAlign: 'right',
      alignSelf: 'stretch',
      fontSize: 12,
      color: c.textMuted,
      marginBottom: 10,
    },
    search: {
      minHeight: 44,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 14,
      color: c.text,
      backgroundColor: chipBg,
    },
    classFilters: {
      paddingHorizontal: 16,
      gap: 6,
      paddingBottom: 8,
      flexDirection: 'row-reverse',
    },
    classChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: chipBg,
    },
    classChipText: { fontSize: 11, color: c.text, textAlign: 'center' },
    sortRow: {
      flexDirection: 'row-reverse',
      flexWrap: 'wrap',
      gap: 6,
      paddingHorizontal: 16,
      marginBottom: 8,
    },
    sortChip: {
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor: chipBg,
    },
    sortOn: { backgroundColor: accent.primaryGlow, borderWidth: 1, borderColor: c.primary },
    sortText: { fontSize: 11, color: c.textMuted, textAlign: 'center' },
    list: { paddingHorizontal: 16, marginTop: 4 },
  }));

  const dict = t();
  const hidden = snapshot.settings.hideBalances;

  const [range, setRange] = useState<WealthRange>('3M');
  const [allocFilter, setAllocFilter] = useState<AllocationFilter>('all');
  const [query, setQuery] = useState('');
  const [classFilter, setClassFilter] = useState<AssetClass | 'all'>('all');
  const [sort, setSort] = useState<WealthSort>('value');

  const summary = useMemo(() => summarizePortfolio(snapshot.accounts), [snapshot.accounts]);
  const history = useMemo(
    () => filterNetWorthHistory(snapshot.netWorthHistory ?? [], range),
    [snapshot.netWorthHistory, range],
  );
  const changePct = useMemo(() => netWorthChangePct(history), [history]);
  const slices = useMemo(
    () => buildAllocation(snapshot.accounts, allocFilter),
    [snapshot.accounts, allocFilter],
  );
  const holdings = useMemo(
    () =>
      filterAndSortHoldings(snapshot.accounts, {
        query,
        assetClass: classFilter,
        sort,
      }),
    [snapshot.accounts, query, classFilter, sort],
  );

  const hasLiveHoldings = useMemo(
    () => snapshot.accounts.some(a => supportsLivePrice(a)),
    [snapshot.accounts],
  );

  const emptyState = useMemo(() => {
    if (query.trim() && holdings.length === 0) {
      return {
        title: dict.wealth.searchEmpty,
        subtitle: dict.wealth.searchEmptyHint,
      };
    }
    if (classFilter !== 'all' && holdings.length === 0) {
      return {
        title: dict.wealth.emptyByClass[classFilter],
        subtitle: dict.wealth.emptyHint,
      };
    }
    return {
      title: dict.wealth.empty,
      subtitle: dict.wealth.emptyHint,
    };
  }, [classFilter, dict.wealth, holdings.length, query]);

  const autoPrice = snapshot.settings.autoPriceUpdates !== false;

  const doRefresh = useCallback(async () => {
    setPriceError(false);
    setRefreshing(true);
    try {
      const updated = await refreshWealthPrices();
      if (updated === 0 && hasLiveHoldings) {
        setPriceError(true);
      }
    } finally {
      setRefreshing(false);
    }
  }, [hasLiveHoldings, refreshWealthPrices]);

  useFocusEffect(
    useCallback(() => {
      if (!autoPrice) {
        return;
      }
      void doRefresh();
      const id = setInterval(() => {
        void doRefresh();
      }, 120_000);
      return () => clearInterval(id);
    }, [autoPrice, doRefresh]),
  );

  if (!hydrated) {
    return (
      <NightCanvas>
        <View style={[styles.skeletonWrap, { paddingTop: insets.top + 8 }]}>
          <Skeleton height={28} radius={8} />
          <Skeleton height={200} radius={26} />
          <Skeleton height={160} radius={24} />
          <Skeleton height={88} radius={18} />
          <Skeleton height={88} radius={18} />
        </View>
      </NightCanvas>
    );
  }

  return (
    <NightCanvas>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 128 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void doRefresh()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }>
        <View style={styles.topBar}>
          <AppText style={styles.screenTitle}>{dict.vault.title}</AppText>
          <Pressable
            style={[
              styles.addBtn,
              {
                backgroundColor: accent.primaryGlow,
                borderColor: colors.primary,
              },
            ]}
            onPress={() => nav.navigate('AddWealthAsset')}>
            <Plus size={16} color={colors.primary} strokeWidth={2.4} />
            <AppText style={[styles.addBtnText, { color: colors.primary }]}>
              {dict.wealth.addAsset}
            </AppText>
          </Pressable>
        </View>
        <AppText variant="caption" style={styles.screenSubtitle}>
          {dict.vault.subtitle}
        </AppText>
        <Pressable onPress={() => void doRefresh()} style={styles.refreshRow}>
          <AppText variant="caption" style={{ color: colors.primary, textAlign: 'right' }}>
            {refreshing ? dict.wealth.pricesRefreshing : dict.wealth.pricesRefresh}
          </AppText>
        </Pressable>

        {priceError ? (
          <View style={{ paddingHorizontal: 16, marginBottom: 10 }}>
            <AlertBanner
              tone="warn"
              message={dict.wealth.pricesRefreshFailed}
              onPress={() => void doRefresh()}
            />
          </View>
        ) : null}

        <NetWorthHero
          summary={summary}
          history={history}
          range={range}
          onRangeChange={setRange}
          changePct={changePct}
          hidden={hidden}
        />

        <AllocationPanel
          slices={slices}
          filter={allocFilter}
          onFilterChange={setAllocFilter}
          hidden={hidden}
        />

        {snapshot.accounts.length > 0 ? (
          <View style={styles.perfRow}>
            <View style={styles.perfCard}>
              <AppText style={styles.perfLabel}>{dict.wealth.unrealizedPl}</AppText>
              <AppText
                style={[
                  styles.perfValue,
                  {
                    color:
                      summary.unrealizedPlRial >= 0 ? colors.income : colors.expense,
                  },
                ]}>
                {hidden
                  ? '••••'
                  : `${summary.unrealizedPlRial > 0 ? '+' : ''}${formatTomanFromRial(summary.unrealizedPlRial)}`}
              </AppText>
            </View>
            <View style={styles.perfCard}>
              <AppText style={styles.perfLabel}>{dict.wealth.liquid}</AppText>
              <AppText style={styles.perfValue}>
                {hidden ? '••••' : formatTomanFromRial(summary.liquidRial)}
              </AppText>
            </View>
            <View style={styles.perfCard}>
              <AppText style={styles.perfLabel}>{dict.wealth.illiquid}</AppText>
              <AppText style={styles.perfValue}>
                {hidden ? '••••' : formatTomanFromRial(summary.illiquidRial)}
              </AppText>
            </View>
          </View>
        ) : null}

        <View style={styles.listHeader}>
          <AppText style={styles.listTitle}>{dict.wealth.holdingsTitle}</AppText>
          <AppText style={styles.listHint}>{dict.wealth.holdingsHint}</AppText>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={dict.wealth.search}
            placeholderTextColor={colors.textMuted}
            textAlign="right"
            style={styles.search}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.classFilters}>
          <Pressable
            onPress={() => setClassFilter('all')}
            style={[
              styles.classChip,
              classFilter === 'all' && {
                borderColor: colors.primary,
                backgroundColor: accent.primaryGlow,
              },
            ]}>
            <AppText style={styles.classChipText}>{dict.accounts.filterAll}</AppText>
          </Pressable>
          {ASSET_CLASS_ORDER.map(cls => (
            <Pressable
              key={cls}
              onPress={() => setClassFilter(cls)}
              style={[
                styles.classChip,
                classFilter === cls && {
                  borderColor: colors.primary,
                  backgroundColor: accent.primaryGlow,
                },
              ]}>
              <AppText style={styles.classChipText}>{dict.wealth.classes[cls]}</AppText>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.sortRow}>
          {(
            [
              ['value', dict.wealth.sort.value],
              ['profit', dict.wealth.sort.profit],
              ['profit_pct', dict.wealth.sort.profitPct],
              ['updated', dict.wealth.sort.updated],
              ['name', dict.wealth.sort.name],
            ] as Array<[WealthSort, string]>
          ).map(([id, label]) => (
            <Pressable
              key={id}
              onPress={() => setSort(id)}
              style={[styles.sortChip, sort === id && styles.sortOn]}>
              <AppText
                style={[
                  styles.sortText,
                  sort === id && { color: colors.text },
                ]}>
                {label}
              </AppText>
            </Pressable>
          ))}
        </View>

        <View style={styles.list}>
          {holdings.length === 0 ? (
            <EmptyState
              title={emptyState.title}
              subtitle={emptyState.subtitle}
              actionLabel={dict.wealth.addAsset}
              onAction={() => nav.navigate('AddWealthAsset')}
            />
          ) : (
            holdings.map((acc, index) => (
              <WealthHoldingCard
                key={acc.id}
                account={acc}
                hidden={hidden}
                index={index}
                onPress={() => nav.navigate('AssetDetail', { id: acc.id })}
              />
            ))
          )}
        </View>
      </ScrollView>
    </NightCanvas>
  );
}
