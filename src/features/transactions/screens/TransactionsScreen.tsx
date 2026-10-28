import { SwipeTxRow } from '../../../components/lists/SwipeTxRow';
import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, Share, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, SlidersHorizontal } from 'lucide-react-native';
import { AppText } from '../../../components/ui/AppText';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { Badge } from '../../../components/ui/Badge';
import { PressScale } from '../../../components/ui/PressScale';
import { TransactionRow } from '../../../components/lists/TransactionRow';
import { Surface } from '../../../components/ui/Surface';
import { EmptyState } from '../../../components/feedback/EmptyState';
import {
  countActiveFilters,
  DEFAULT_TX_FILTERS,
  TransactionFilterSheet,
  type TransactionFilterState,
} from '../components/TransactionFilterSheet';
import { t } from '../../../i18n';
import { useFinanceStore } from '../../../store/finance/store';
import { isSameDay, startOfJalaliMonth, addJalaliMonths } from '../../../utils/dates/jalali';
import { transactionsToCsv } from '../../../engine/insights/pro';
import { hapticSuccess } from '../../../utils/haptics';
import { tomanToRial } from '../../../utils/currency/money';
import { parseIntegerAmount, toEnglishDigits } from '../../../utils/numbers/digits';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../app/navigation/types';
import type { Transaction } from '../../../types/finance';

const FILTERS = ['all', 'expense', 'income', 'transfer'] as const;

type TxSection = {
  id: string;
  label: string;
  transactions: Transaction[];
};

function groupLabel(iso: string, dict: ReturnType<typeof t>['transactions']): string {
  const now = new Date().toISOString();
  if (isSameDay(iso, now)) {
    return dict.today;
  }
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (isSameDay(iso, y.toISOString())) {
    return dict.yesterday;
  }
  return dict.thisWeek;
}

export function TransactionsScreen({
  navigation,
  embedded = false,
}: {
  navigation: NativeStackNavigationProp<RootStackParamList>;
  embedded?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useThemedStyles((c, th) => ({
    screen: { flex: 1, backgroundColor: 'transparent' },
    headerWrap: { paddingHorizontal: 20 },
    search: {
      marginHorizontal: 20,
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 8,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surfaceSolid,
      paddingHorizontal: 12,
      minHeight: 48,
      marginBottom: 12,
    },
    input: {
      flex: 1,
      color: c.text,
      fontFamily: th.typography.fontFamily.regular,
      fontSize: 15,
    },
    filterBar: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 20,
      marginBottom: 8,
    },
    filterToggle: {
      width: 44,
      height: 44,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surfaceSolid,
    },
    filterToggleOn: {
      borderColor: c.primary,
      backgroundColor: 'rgba(59,232,197,0.1)',
    },
    filterBadge: { position: 'absolute' as const, top: 4, left: 4 },
    group: {
      marginTop: 18,
      marginBottom: 8,
      textAlign: 'right',
      writingDirection: 'rtl',
      paddingHorizontal: 4,
    },
    sectionCard: {
      marginBottom: 4,
      paddingHorizontal: 10,
      paddingVertical: 2,
      overflow: 'hidden',
    },
  }));
  const snapshot = useFinanceStore(s => s.snapshot);
  const runIncrementalSmsSync = useFinanceStore(s => s.runIncrementalSmsSync);
  const smsSyncStatus = useFinanceStore(s => s.smsSync.status);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [advFilters, setAdvFilters] = useState<TransactionFilterState>(DEFAULT_TX_FILTERS);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const dict = t();
  const activeFilterCount = countActiveFilters(advFilters);
  const { period, accountId, categoryId, minToman, maxToman } = advFilters;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await runIncrementalSmsSync();
    } finally {
      setRefreshing(false);
    }
  }, [runIncrementalSmsSync]);

  const data = useMemo(() => {
    const thisStart = startOfJalaliMonth().getTime();
    const lastStart = startOfJalaliMonth(addJalaliMonths(new Date().toISOString(), -1)).getTime();
    const minRial = parseIntegerAmount(toEnglishDigits(minToman));
    const maxRial = parseIntegerAmount(toEnglishDigits(maxToman));
    return snapshot.transactions
      .filter(tx => {
        if (filter === 'expense') {
          if (!(tx.direction === 'out' && tx.type !== 'transfer')) {
            return false;
          }
        } else if (filter === 'income') {
          if (!(tx.direction === 'in' && tx.type !== 'transfer')) {
            return false;
          }
        } else if (filter === 'transfer') {
          if (!(tx.type === 'transfer' || Boolean(tx.transferId))) {
            return false;
          }
        }
        const tms = Date.parse(tx.transactionDate);
        if (period === 'thisMonth' && tms < thisStart) {
          return false;
        }
        if (period === 'lastMonth' && (tms < lastStart || tms >= thisStart)) {
          return false;
        }
        if (accountId !== 'all' && tx.accountId !== accountId) {
          return false;
        }
        if (categoryId !== 'all' && tx.categoryId !== categoryId) {
          return false;
        }
        if (minRial && tx.amountRial < tomanToRial(minRial)) {
          return false;
        }
        if (maxRial && tx.amountRial > tomanToRial(maxRial)) {
          return false;
        }
        if (q) {
          const hay = `${tx.merchant ?? ''} ${tx.description ?? ''} ${tx.notes ?? ''}`;
          if (!hay.includes(q)) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        const cmp = b.transactionDate.localeCompare(a.transactionDate);
        if (cmp !== 0) {
          return cmp;
        }
        return String(b.sourceSmsId ?? '').localeCompare(String(a.sourceSmsId ?? ''), undefined, {
          numeric: true,
        });
      });
  }, [snapshot.transactions, q, filter, period, accountId, categoryId, minToman, maxToman]);

  const sections = useMemo((): TxSection[] => {
    const out: TxSection[] = [];
    for (const tx of data) {
      const label = groupLabel(tx.transactionDate, dict.transactions);
      const last = out[out.length - 1];
      if (last?.label === label) {
        last.transactions.push(tx);
      } else {
        out.push({ id: `${label}-${tx.id}`, label, transactions: [tx] });
      }
    }
    return out;
  }, [data, dict.transactions]);

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={refreshing || smsSyncStatus === 'scanning'}
        onRefresh={() => void onRefresh()}
        tintColor={colors.primary}
        colors={[colors.primary]}
        title={dict.sms.syncRefreshing}
        titleColor={colors.textMuted}
      />
    ),
    [
      refreshing,
      smsSyncStatus,
      onRefresh,
      colors.primary,
      colors.textMuted,
      dict.sms.syncRefreshing,
    ],
  );

  const renderSection = useCallback(
    ({ item }: { item: TxSection }) => (
      <View>
        <AppText variant="label" style={styles.group}>
          {item.label}
        </AppText>
        <Surface level="raised" style={styles.sectionCard}>
          {item.transactions.map((tx, index) => (
            <SwipeTxRow key={tx.id} tx={tx}>
              <TransactionRow
                tx={tx}
                compact
                grouped
                isLast={index === item.transactions.length - 1}
                showDate={index === 0}
                onPress={() => navigation.navigate('TransactionDetails', { id: tx.id })}
              />
            </SwipeTxRow>
          ))}
        </Surface>
      </View>
    ),
    [navigation, styles.group, styles.sectionCard],
  );

  return (
    <NightCanvas>
      <View
        style={[
          styles.screen,
          { paddingTop: insets.top + 8, paddingBottom: embedded ? 108 : insets.bottom },
        ]}>
        <View style={styles.headerWrap}>
          <ScreenHeader
            title={dict.transactions.title}
            onBack={embedded ? undefined : () => navigation.goBack()}
            right={
              <PressScale
                onPress={() => {
                  hapticSuccess();
                  void Share.share({
                    message: transactionsToCsv(snapshot.transactions),
                    title: dict.insights.exportCsv,
                  });
                }}>
                <AppText variant="caption" style={{ color: colors.primary }}>
                  CSV
                </AppText>
              </PressScale>
            }
          />
        </View>

        <View style={styles.search}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={dict.transactions.search}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            textAlign="right"
          />
          <Search color={colors.textMuted} size={18} />
        </View>

        <View style={styles.filterBar}>
          <SegmentedControl
            options={[...FILTERS]}
            value={filter}
            onChange={setFilter}
            labelFor={f => dict.transactions[f]}
          />
          <PressScale
            onPress={() => setFilterSheetOpen(true)}
            style={[styles.filterToggle, activeFilterCount > 0 && styles.filterToggleOn]}>
            <SlidersHorizontal
              color={activeFilterCount > 0 ? colors.primary : colors.textSecondary}
              size={18}
            />
            {activeFilterCount > 0 ? (
              <Badge label={activeFilterCount} style={styles.filterBadge} />
            ) : null}
          </PressScale>
        </View>

        <TransactionFilterSheet
          visible={filterSheetOpen}
          onClose={() => setFilterSheetOpen(false)}
          value={advFilters}
          onChange={setAdvFilters}
          accounts={snapshot.accounts}
        />

        {sections.length === 0 ? (
          <View style={{ flex: 1 }}>
            <FlashList
              data={[] as TxSection[]}
              renderItem={() => null}
              refreshControl={refreshControl}
              ListEmptyComponent={<EmptyState title={dict.transactions.empty} />}
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingBottom: embedded ? 24 : 40,
                flexGrow: 1,
              }}
            />
          </View>
        ) : (
          <FlashList
            data={sections}
            keyExtractor={(item: TxSection) => item.id}
            refreshControl={refreshControl}
            renderItem={renderSection}
            drawDistance={250}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: embedded ? 24 : 40 }}
          />
        )}
      </View>
    </NightCanvas>
  );
}
