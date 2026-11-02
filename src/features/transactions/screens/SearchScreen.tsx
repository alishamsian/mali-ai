import React, { useDeferredValue, useMemo, useState } from 'react';
import { FlatList, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText } from '../../../components/ui/AppText';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { FilterChip } from '../../../components/ui/FilterChip';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { TransactionRow } from '../../../components/lists/TransactionRow';
import { SwipeTxRow } from '../../../components/lists/SwipeTxRow';
import { t, interpolate } from '../../../i18n';
import { useFinanceStore } from '../../../store/finance/store';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { formatTomanFromRial, displayUnitLabel } from '../../../utils/currency/money';
import { toEnglishDigits, toPersianDigits } from '../../../utils/numbers/digits';
import { isExpenseLike, isIncomeLike } from '../../../engine/insights/analytics';
import type { Transaction } from '../../../types/finance';
import type { RootStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Search'>;
type Kind = 'all' | 'expense' | 'income';
const LIMIT = 200;

const fold = (text: string) =>
  toEnglishDigits(text)
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[,٬\s]/g, '')
    .toLowerCase();

/** Every transaction, searched by merchant, notes, category name and amount (toman or rial). */
export function SearchScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const dict = t();
  const transactions = useFinanceStore(s => s.snapshot.transactions);
  const hidden = useFinanceStore(s => s.snapshot.settings.hideBalances);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<Kind>('all');
  const deferred = useDeferredValue(query);

  const { rows, total, count } = useMemo(() => {
    const q = fold(deferred);
    const matchKind = (tx: Transaction) =>
      kind === 'all' ? true : kind === 'expense' ? isExpenseLike(tx) : isIncomeLike(tx);
    const matches = transactions
      .filter(tx => {
        if (!matchKind(tx)) {
          return false;
        }
        if (!q) {
          return true;
        }
        const hay = fold(
          [
            tx.merchant,
            tx.receiptCode,
            tx.notes,
            tx.description,
            dict.categories[tx.categoryId],
            String(tx.amountRial / 10),
            String(tx.amountRial),
          ]
            .filter(Boolean)
            .join('|'),
        );
        return hay.includes(q);
      })
      .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
    return {
      rows: matches.slice(0, LIMIT),
      total: matches.reduce((sum, tx) => sum + tx.amountRial, 0),
      count: matches.length,
    };
  }, [deferred, kind, transactions, dict.categories]);

  const styles = useThemedStyles((c, th) => ({
    head: {
      paddingHorizontal: th.spacing.lg,
      paddingTop: insets.top + 8,
      gap: 12,
      paddingBottom: 8,
    },
    field: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      minHeight: 50,
    },
    input: { flex: 1, color: c.text, fontSize: 15, fontFamily: th.typography.fontFamily.regular },
    chips: { flexDirection: 'row-reverse', gap: 8 },
    summary: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
    muted: { color: c.textMuted, fontSize: 12 },
    list: { paddingHorizontal: th.spacing.lg, paddingBottom: insets.bottom + 24 },
  }));

  return (
    <NightCanvas>
      <View style={styles.head}>
        <ScreenHeader title={dict.search.title} onBack={() => navigation.goBack()} />
        <GlassPanel strong radius={18} style={styles.field}>
          <Search size={18} color={colors.textMuted} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder={dict.search.placeholder}
            placeholderTextColor={colors.textMuted}
            textAlign="right"
            returnKeyType="search"
            accessibilityLabel={dict.search.a11y}
            style={styles.input}
          />
        </GlassPanel>
        <View style={styles.chips}>
          {(['all', 'expense', 'income'] as Kind[]).map(k => (
            <FilterChip
              key={k}
              label={dict.search[k]}
              active={kind === k}
              onPress={() => setKind(k)}
            />
          ))}
        </View>
        {count > 0 ? (
          <View style={styles.summary}>
            <AppText style={styles.muted}>
              {interpolate(dict.search.results, { n: toPersianDigits(count) })}
            </AppText>
            <AppText style={styles.muted}>
              {`${dict.search.total} ${
                hidden ? '••••' : formatTomanFromRial(total)
              } ${displayUnitLabel()}`}
            </AppText>
          </View>
        ) : null}
      </View>
      <FlatList
        data={rows}
        keyExtractor={tx => tx.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        initialNumToRender={14}
        windowSize={7}
        ListEmptyComponent={
          <EmptyState Icon={Search} title={dict.search.empty} subtitle={dict.search.emptyHint} />
        }
        renderItem={({ item, index }) => (
          <SwipeTxRow tx={item}>
            <TransactionRow
              tx={item}
              compact
              grouped
              hidden={hidden}
              isLast={index === rows.length - 1}
              onPress={() => navigation.navigate('TransactionDetails', { id: item.id })}
            />
          </SwipeTxRow>
        )}
      />
    </NightCanvas>
  );
}
