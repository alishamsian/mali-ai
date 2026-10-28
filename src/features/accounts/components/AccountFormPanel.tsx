import { appAlert } from '../../../components/ui/AppAlert';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { AppText } from '../../../components/ui/AppText';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { BankPickerField } from '../../banks/components/BankPickerField';
import { AssetCatalogPickerField } from './AssetCatalogPickerField';
import { resolveBankName } from '../../banks/names';
import { t } from '../../../i18n';
import { formatTomanFromRial, rialToToman, tomanToRial } from '../../../utils/currency/money';
import { AmountInput } from '../../../components/ui/AmountInput';
import { parseIntegerAmount, toEnglishDigits, toPersianDigits } from '../../../utils/numbers/digits';
import type { AssetId, FinancialAccount } from '../../../types/finance';
import { assetValueRial, getAssetCatalog } from '../catalog/assets';

export type AccountFormKind = 'bank' | 'cash' | 'asset';

export type AccountSavePayload =
  | {
      formKind: 'bank';
      bankId: string;
      name: string;
      last4: string;
      balanceRial: number;
    }
  | {
      formKind: 'cash';
      name: string;
      balanceRial: number;
    }
  | {
      formKind: 'asset';
      assetId: AssetId;
      name: string;
      quantity: number;
      unitPriceRial: number;
      balanceRial: number;
    };

function parseDecimal(raw: string): number | null {
  const n = toEnglishDigits(raw).replace(/[^\d.]/g, '');
  if (!n || n === '.') {
    return null;
  }
  const value = Number.parseFloat(n);
  return Number.isFinite(value) ? value : null;
}

function sanitizeDecimalInput(v: string): string {
  const en = toEnglishDigits(v).replace(/[^\d.]/g, '');
  const parts = en.split('.');
  if (parts.length <= 1) {
    return en;
  }
  return `${parts[0]}.${parts.slice(1).join('').slice(0, 4)}`;
}

export function AccountFormPanel({
  mode,
  account,
  onSave,
  onDelete,
  onCancel,
}: {
  mode: 'add' | 'edit';
  account?: FinancialAccount;
  onSave: (payload: AccountSavePayload) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const dict = t();
  const { colors } = useAppTheme();
  const styles = useThemedStyles((c, th) => ({
    panel: {
      gap: 10,
      marginTop: 12,
      padding: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surfaceSolid,
    },
    header: {
      flexDirection: 'row-reverse',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    kindRow: { flexDirection: 'row-reverse', gap: 8 },
    kindChip: {
      flex: 1,
      minHeight: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    kindChipOn: {
      borderColor: c.primary,
      backgroundColor: th.palette.primaryGlow,
    },
    banks: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
    bankChip: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },
    bankChipOn: { borderColor: c.primary, backgroundColor: th.palette.primaryGlow },
    input: {
      minHeight: 46,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      color: c.text,
      paddingHorizontal: 14,
      backgroundColor: c.surface,
    },
    valuePreview: {
      flexDirection: 'row-reverse',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: 4,
    },
    hint: {
      textAlign: 'right',
      color: c.textMuted,
      lineHeight: 18,
    },
    deleteBtn: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
  }));
  const initialKind: AccountFormKind =
    account?.kind === 'asset'
      ? 'asset'
      : account?.kind === 'cash' || account?.kind === 'wallet'
        ? 'cash'
        : 'bank';

  const [formKind, setFormKind] = useState<AccountFormKind>(initialKind);
  const [bankId, setBankId] = useState<string>(account?.bankId ?? 'melli');
  const [assetId, setAssetId] = useState<AssetId>(account?.assetId ?? 'gold_gram');
  const [name, setName] = useState(account?.name ?? '');
  const [last4, setLast4] = useState(account?.cardLast4 ?? '');
  const [balance, setBalance] = useState(
    account && account.kind !== 'asset' ? String(rialToToman(account.balanceRial)) : '',
  );
  const [quantity, setQuantity] = useState(
    account?.quantity != null ? String(account.quantity) : '',
  );
  const [unitPrice, setUnitPrice] = useState(
    account?.unitPriceRial != null ? String(rialToToman(account.unitPriceRial)) : '',
  );

  const catalog = getAssetCatalog(assetId);
  const lockKind = mode === 'edit';

  useEffect(() => {
    const kind: AccountFormKind =
      account?.kind === 'asset'
        ? 'asset'
        : account?.kind === 'cash' || account?.kind === 'wallet'
          ? 'cash'
          : 'bank';
    setFormKind(kind);
    setBankId(account?.bankId ?? 'melli');
    setAssetId(account?.assetId ?? 'gold_gram');
    setName(account?.name ?? '');
    setLast4(account?.cardLast4 ?? '');
    setBalance(
      account && account.kind !== 'asset' ? String(rialToToman(account.balanceRial)) : '',
    );
    setQuantity(account?.quantity != null ? String(account.quantity) : '');
    setUnitPrice(
      account?.unitPriceRial != null ? String(rialToToman(account.unitPriceRial)) : '',
    );
  }, [account, mode]);

  useEffect(() => {
    if (mode !== 'add' || formKind !== 'asset') {
      return;
    }
    const item = getAssetCatalog(assetId);
    if (!item) {
      return;
    }
    setUnitPrice(prev => (prev ? prev : item.hintUnitToman != null ? String(item.hintUnitToman) : prev));
    setName(prev => (prev.trim() ? prev : dict.accounts.assets[assetId]));
  }, [assetId, dict.accounts.assets, formKind, mode]);

  const liveAssetValue = useMemo(() => {
    const q = parseDecimal(quantity) ?? 0;
    const priceToman = parseIntegerAmount(unitPrice) ?? 0;
    return assetValueRial(q, tomanToRial(priceToman));
  }, [quantity, unitPrice]);

  const title = mode === 'add' ? dict.accounts.add : dict.accounts.edit;

  const handleSave = () => {
    if (formKind === 'bank') {
      const toman = parseIntegerAmount(balance) ?? 0;
      onSave({
        formKind: 'bank',
        bankId,
        name: name.trim() || resolveBankName(bankId),
        last4: last4.trim().slice(-4),
        balanceRial: tomanToRial(toman),
      });
      return;
    }
    if (formKind === 'cash') {
      const toman = parseIntegerAmount(balance) ?? 0;
      onSave({
        formKind: 'cash',
        name: name.trim() || dict.accounts.cash,
        balanceRial: tomanToRial(toman),
      });
      return;
    }

    const q = parseDecimal(quantity);
    const priceToman = parseIntegerAmount(unitPrice);
    if (q == null || q <= 0 || priceToman == null || priceToman < 0) {
      appAlert(dict.accounts.assetInvalidTitle, dict.accounts.assetInvalidBody);
      return;
    }
    const unitPriceRial = tomanToRial(priceToman);
    const defaultName = dict.accounts.assets[assetId];
    onSave({
      formKind: 'asset',
      assetId,
      name: name.trim() || defaultName,
      quantity: q,
      unitPriceRial,
      balanceRial: assetValueRial(q, unitPriceRial),
    });
  };

  const handleDelete = () => {
    if (!onDelete) {
      return;
    }
    appAlert(dict.accounts.deleteTitle, dict.accounts.deleteBody, [
      { text: dict.common.cancel, style: 'cancel' },
      { text: dict.transactions.delete, style: 'destructive', onPress: onDelete },
    ]);
  };

  const kinds: { id: AccountFormKind; label: string }[] = [
    { id: 'bank', label: dict.accounts.bank },
    { id: 'cash', label: dict.accounts.cash },
    { id: 'asset', label: dict.accounts.asset },
  ];

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <AppText variant="label">{title}</AppText>
        <Pressable onPress={onCancel} hitSlop={8}>
          <AppText variant="caption" style={{ color: colors.textMuted }}>
            {dict.common.cancel}
          </AppText>
        </Pressable>
      </View>

      {!lockKind ? (
        <View style={styles.kindRow}>
          {kinds.map(k => (
            <Pressable
              key={k.id}
              onPress={() => setFormKind(k.id)}
              style={[styles.kindChip, formKind === k.id && styles.kindChipOn]}>
              <AppText
                variant="caption"
                style={{
                  color: formKind === k.id ? colors.primary : colors.text,
                }}>
                {k.label}
              </AppText>
            </Pressable>
          ))}
        </View>
      ) : null}

      {formKind === 'bank' ? (
        <BankPickerField
          selectedId={bankId}
          onSelect={setBankId}
          searchPlaceholder={dict.sms.searchBank}
        />
      ) : null}

      {formKind === 'asset' ? (
        <AssetCatalogPickerField
          selectedId={assetId}
          onSelect={id => {
            setAssetId(id);
            const item = getAssetCatalog(id);
            if (mode === 'add' && item?.hintUnitToman != null) {
              setUnitPrice(String(item.hintUnitToman));
            }
            if (!name.trim()) {
              setName(dict.accounts.assets[id]);
            }
          }}
        />
      ) : null}

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={
          formKind === 'asset' ? dict.accounts.assetNameField : dict.accounts.nameField
        }
        placeholderTextColor={colors.textMuted}
        textAlign="right"
        style={styles.input}
      />

      {formKind === 'bank' ? (
        <TextInput
          value={last4}
          onChangeText={v => setLast4(toEnglishDigits(v).replace(/\D/g, '').slice(-4))}
          placeholder={dict.accounts.card}
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          textAlign="right"
          style={styles.input}
        />
      ) : null}

      {formKind === 'asset' ? (
        <>
          <TextInput
            value={quantity ? toPersianDigits(quantity) : ''}
            onChangeText={v => setQuantity(sanitizeDecimalInput(v))}
            placeholder={`${dict.accounts.quantityField} (${dict.accounts.units[catalog?.unitKey ?? 'unit']})`}
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            textAlign="right"
            style={styles.input}
          />
          <AmountInput
            value={unitPrice}
            onChangeValue={setUnitPrice}
            placeholder={dict.accounts.unitPriceField}
          />
          <View style={styles.valuePreview}>
            <AppText variant="caption" style={{ color: colors.textMuted }}>
              {dict.accounts.assetValue}
            </AppText>
            <AppText variant="label">
              {formatTomanFromRial(liveAssetValue)} {dict.common.toman}
            </AppText>
          </View>
          <AppText variant="caption" style={styles.hint}>
            {dict.accounts.priceHint}
          </AppText>
        </>
      ) : (
        <AmountInput
          value={balance}
          onChangeValue={setBalance}
          placeholder={dict.accounts.balanceField}
        />
      )}

      <PrimaryButton label={dict.common.save} onPress={handleSave} />

      {mode === 'edit' && onDelete ? (
        <Pressable style={styles.deleteBtn} onPress={handleDelete}>
          <AppText style={{ color: colors.expense }}>{dict.transactions.delete}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
