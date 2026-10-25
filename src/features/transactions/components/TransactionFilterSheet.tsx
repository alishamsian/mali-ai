import React from 'react';
import { Pressable, View } from 'react-native';
import { AmountInput } from '../../../components/ui/AmountInput';
import { sanitizeAmountDigits } from '../../../utils/numbers/digits';
import { BottomSheet } from '../../../components/ui/BottomSheet';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { AppText } from '../../../components/ui/AppText';
import { OptionPickerField } from '../../../components/ui/OptionPickerField';
import { AccountPickerField } from '../../accounts/components/AccountPickerField';
import { CategoryPickerField } from './CategoryPickerField';
import { t } from '../../../i18n';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { EXPENSE_CATEGORIES } from '../../../constants/categories';
import type { CategoryId, FinancialAccount } from '../../../types/finance';

const PERIODS = ['allTime', 'thisMonth', 'lastMonth'] as const;

export type TransactionPeriod = (typeof PERIODS)[number];

export type TransactionFilterState = {
  period: TransactionPeriod;
  accountId: string;
  categoryId: CategoryId | 'all';
  minToman: string;
  maxToman: string;
};

export const DEFAULT_TX_FILTERS: TransactionFilterState = {
  period: 'allTime',
  accountId: 'all',
  categoryId: 'all',
  minToman: '',
  maxToman: '',
};

export function countActiveFilters(f: TransactionFilterState): number {
  let n = 0;
  if (f.period !== 'allTime') {
    n++;
  }
  if (f.accountId !== 'all') {
    n++;
  }
  if (f.categoryId !== 'all') {
    n++;
  }
  if (f.minToman.trim()) {
    n++;
  }
  if (f.maxToman.trim()) {
    n++;
  }
  return n;
}

export function TransactionFilterSheet({
  visible,
  onClose,
  value,
  onChange,
  accounts,
}: {
  visible: boolean;
  onClose: () => void;
  value: TransactionFilterState;
  onChange: (next: TransactionFilterState) => void;
  accounts: FinancialAccount[];
}) {
  const dict = t();
  const styles = useThemedStyles((c, th) => ({
    amountRow: { flexDirection: 'row-reverse', gap: th.spacing.sm, marginTop: th.spacing.sm },
    amountInput: {
      flex: 1,
      minHeight: 48,
      borderRadius: th.radii.md,
      borderWidth: 1,
      borderColor: c.border,
      color: c.text,
      paddingHorizontal: 12,
      fontFamily: th.typography.fontFamily.regular,
      backgroundColor: c.surfaceSolid,
    },
    ghost: { marginTop: th.spacing.xs, alignItems: 'center' as const },
    ghostText: { color: c.textMuted },
  }));

  const patch = (partial: Partial<TransactionFilterState>) => {
    onChange({ ...value, ...partial });
  };

  return (
    <BottomSheet
      visible={visible}
      title={dict.transactions.filtersTitle}
      onClose={onClose}
      footer={
        <>
          <PrimaryButton label={dict.transactions.applyFilters} onPress={onClose} />
          <Pressable onPress={() => onChange(DEFAULT_TX_FILTERS)} style={styles.ghost}>
            <AppText variant="caption" style={styles.ghostText}>
              {dict.transactions.resetFilters}
            </AppText>
          </Pressable>
        </>
      }>
      <OptionPickerField
        label={dict.transactions.period}
        options={[...PERIODS]}
        value={value.period}
        onChange={p => patch({ period: p })}
        labelOf={p => dict.transactions[p]}
        title={dict.transactions.period}
        searchable={false}
      />
      <AccountPickerField
        label={dict.transactions.bank}
        accounts={accounts}
        selectedId={value.accountId}
        onSelect={id => patch({ accountId: id })}
        allowAll
      />
      <CategoryPickerField
        label={dict.transactions.category}
        categories={EXPENSE_CATEGORIES}
        selectedId={value.categoryId}
        onSelect={id => patch({ categoryId: id })}
        allowAll
      />
      <View style={styles.amountRow}>
        <AmountInput
          value={value.maxToman}
          onChangeValue={v => patch({ maxToman: sanitizeAmountDigits(v) })}
          placeholder={dict.transactions.maxAmount}
          style={{ flex: 1 }}
          inputStyle={styles.amountInput}
        />
        <AmountInput
          value={value.minToman}
          onChangeValue={v => patch({ minToman: sanitizeAmountDigits(v) })}
          placeholder={dict.transactions.minAmount}
          style={{ flex: 1 }}
          inputStyle={styles.amountInput}
        />
      </View>
    </BottomSheet>
  );
}
