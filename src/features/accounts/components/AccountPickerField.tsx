import React, { useMemo } from 'react';
import { View } from 'react-native';
import { AppText } from '../../../components/ui/AppText';
import { BankEmblem } from '../../../components/banks/BankEmblem';
import { PickerField, flatPickerSections, type PickerItem } from '../../../components/ui/PickerField';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { t } from '../../../i18n';
import type { FinancialAccount } from '../../../types/finance';

type AccountPickerId = string;

export function AccountPickerField({
  accounts,
  selectedId,
  onSelect,
  label,
  placeholder,
  title,
  searchPlaceholder,
  excludeId,
  allowAll,
  allId = 'all',
  allLabel,
}: {
  accounts: FinancialAccount[];
  selectedId?: AccountPickerId | null;
  onSelect: (id: AccountPickerId) => void;
  label?: string;
  placeholder?: string;
  title?: string;
  searchPlaceholder?: string;
  excludeId?: string;
  allowAll?: boolean;
  allId?: AccountPickerId;
  allLabel?: string;
}) {
  const dict = t();
  const styles = useThemedStyles(c => ({
    block: { gap: 8 },
    fieldLabel: {
      textAlign: 'right' as const,
      color: c.textMuted,
      paddingHorizontal: 2,
    },
    fieldRow: {
      flexDirection: 'row-reverse' as const,
      alignItems: 'center' as const,
      gap: 12,
    },
    fieldMeta: { flex: 1, gap: 2 },
  }));

  const sections = useMemo(() => {
    const items: PickerItem<AccountPickerId>[] = [];
    if (allowAll) {
      items.push({
        id: allId,
        label: allLabel ?? dict.picker.allAccounts,
        keywords: 'all',
      });
    }
    for (const acc of accounts) {
      if (excludeId && acc.id === excludeId) {
        continue;
      }
      items.push({
        id: acc.id,
        label: acc.name,
        subtitle: acc.cardLast4 ? `****${acc.cardLast4}` : undefined,
        leading: <BankEmblem bankId={acc.bankId} size={38} />,
        keywords: `${acc.name} ${acc.bankId ?? ''} ${acc.cardLast4 ?? ''}`,
      });
    }
    return flatPickerSections(items);
  }, [accounts, allId, allLabel, allowAll, dict.picker.allAccounts, excludeId]);

  const selected = useMemo(() => {
    for (const section of sections) {
      const hit = section.items.find(item => item.id === selectedId);
      if (hit) {
        return hit;
      }
    }
    return undefined;
  }, [sections, selectedId]);

  return (
    <View style={styles.block}>
      {label ? (
        <AppText variant="caption" style={styles.fieldLabel}>
          {label}
        </AppText>
      ) : null}
      <PickerField
        selectedId={selectedId}
        onSelect={onSelect}
        sections={sections}
        title={title ?? dict.picker.pickAccountTitle}
        placeholder={placeholder ?? dict.picker.selectAccount}
        searchPlaceholder={searchPlaceholder ?? dict.picker.searchAccount}
        renderValue={() =>
          selected ? (
            <View style={styles.fieldRow}>
              {selected.leading}
              <View style={styles.fieldMeta}>
                <AppText variant="label" style={{ textAlign: 'right' }}>
                  {selected.label}
                </AppText>
                {selected.subtitle ? (
                  <AppText variant="caption" style={{ textAlign: 'right' }} numberOfLines={1}>
                    {selected.subtitle}
                  </AppText>
                ) : null}
              </View>
            </View>
          ) : null
        }
      />
    </View>
  );
}
