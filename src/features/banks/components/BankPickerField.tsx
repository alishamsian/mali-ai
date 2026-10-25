import React, { useMemo } from 'react';
import { View } from 'react-native';
import { AppText } from '../../../components/ui/AppText';
import { BankEmblem } from '../../../components/banks/BankEmblem';
import { PickerField, type PickerSection } from '../../../components/ui/PickerField';
import { BANK_CATEGORY_LABELS } from '../catalog';
import { resolveBankName } from '../names';
import { getBanksByCategory } from '../../sms/registry/banks';
import { t } from '../../../i18n';

export function BankPickerField({
  selectedId,
  onSelect,
  verifiedByBankId,
  placeholder,
  searchPlaceholder,
}: {
  selectedId?: string | null;
  onSelect: (bankId: string) => void;
  verifiedByBankId?: Record<string, string | undefined>;
  placeholder?: string;
  searchPlaceholder?: string;
}) {
  const dict = t();

  const sections = useMemo<PickerSection[]>(() => {
    return getBanksByCategory().map(group => ({
      id: group.category,
      title: BANK_CATEGORY_LABELS[group.category],
      items: group.banks.map(bank => ({
        id: bank.id,
        label: resolveBankName(bank.id),
        subtitle: verifiedByBankId?.[bank.id],
        leading: <BankEmblem bankId={bank.id} size={38} />,
        keywords: `${bank.nameFa} ${bank.id}`,
      })),
    }));
  }, [verifiedByBankId]);

  const verified = selectedId ? verifiedByBankId?.[selectedId] : undefined;

  return (
    <PickerField
      selectedId={selectedId ?? undefined}
      onSelect={onSelect}
      sections={sections}
      title={dict.sms.pickBankTitle}
      placeholder={placeholder ?? dict.sms.selectBank}
      searchPlaceholder={searchPlaceholder ?? dict.sms.searchBank}
      renderValue={() =>
        selectedId ? (
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12, flex: 1 }}>
            <BankEmblem bankId={selectedId} size={40} />
            <View style={{ flex: 1, gap: 3 }}>
              <AppText variant="label" style={{ textAlign: 'right' }}>
                {resolveBankName(selectedId)}
              </AppText>
              {verified ? (
                <AppText variant="caption" style={{ textAlign: 'right' }} numberOfLines={1}>
                  {verified}
                </AppText>
              ) : null}
            </View>
          </View>
        ) : null
      }
    />
  );
}
