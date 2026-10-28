import { appAlert } from '../../../components/ui/AppAlert';
import React, { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppText } from '../../../components/ui/AppText';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { PressScale } from '../../../components/ui/PressScale';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { FilterChip } from '../../../components/ui/FilterChip';
import { AmountField } from '../../../components/ui/AmountInput';
import { t } from '../../../i18n';
import { useFinanceStore } from '../../../store/finance/store';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { tomanToRial } from '../../../utils/currency/money';
import { toEnglishDigits, toPersianDigits } from '../../../utils/numbers/digits';
import {
  addJalaliMonths,
  isoForJalaliDayKey,
  jalaliDayKey,
  jalaliDayLabel,
  shiftJalaliDayKey,
} from '../../../utils/dates/jalali';
import { newObligationId } from '../format';
import type { RootStackParamList } from '../../../app/navigation/types';

type Kind = 'installment' | 'cheque' | 'debt';
const KINDS: Kind[] = ['installment', 'cheque', 'debt'];

function TextField({
  label,
  value,
  onChange,
  placeholder,
  numeric = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  numeric?: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(c => ({
    field: { gap: 6 },
    label: { textAlign: 'right', color: c.textMuted, fontSize: 12 },
    input: {
      minHeight: 46,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.glassBorder,
      color: c.text,
      paddingHorizontal: 14,
      backgroundColor: c.glass,
    },
  }));
  return (
    <View style={styles.field}>
      <AppText style={styles.label}>{label}</AppText>
      <TextInput
        value={numeric ? toPersianDigits(value) : value}
        onChangeText={v => onChange(numeric ? toEnglishDigits(v).replace(/\D/g, '') : v)}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={numeric ? 'number-pad' : 'default'}
        textAlign="right"
        style={styles.input}
      />
    </View>
  );
}

/** Jalali day stepper with quick jumps; no native date picker speaks Jalali. */
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (key: string) => void }) {
  const { colors } = useAppTheme();
  const dict = t().obligations;
  const today = jalaliDayKey(new Date());
  const styles = useThemedStyles((c, th) => ({
    field: { gap: 8 },
    label: { textAlign: 'right', color: c.textMuted, fontSize: 12 },
    stepper: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 6,
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.glassBorder,
      backgroundColor: c.glass,
    },
    day: { fontFamily: th.typography.fontFamily.semibold, color: c.text },
    arrow: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    chips: { flexDirection: 'row-reverse', gap: 8 },
  }));
  const plusMonth = () => onChange(jalaliDayKey(addJalaliMonths(isoForJalaliDayKey(today), 1)));
  return (
    <View style={styles.field}>
      <AppText style={styles.label}>{label}</AppText>
      <View style={styles.stepper}>
        <PressScale accessibilityLabel="+1" onPress={() => onChange(shiftJalaliDayKey(value, 1))} style={styles.arrow}>
          <ChevronLeft size={20} color={colors.text} />
        </PressScale>
        <AppText style={styles.day}>{jalaliDayLabel(value)}</AppText>
        <PressScale accessibilityLabel="-1" onPress={() => onChange(shiftJalaliDayKey(value, -1))} style={styles.arrow}>
          <ChevronRight size={20} color={colors.text} />
        </PressScale>
      </View>
      <View style={styles.chips}>
        <FilterChip label={dict.today} active={value === today} onPress={() => onChange(today)} />
        <FilterChip label={dict.plusWeek} active={false} onPress={() => onChange(shiftJalaliDayKey(today, 7))} />
        <FilterChip label={dict.plusMonth} active={false} onPress={plusMonth} />
      </View>
    </View>
  );
}

export function AddObligationScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const dict = t().obligations;
  const [kind, setKind] = useState<Kind>('installment');
  const [planKind, setPlanKind] = useState<'loan' | 'purchase'>('loan');
  const [chequeDir, setChequeDir] = useState<'issued' | 'received'>('issued');
  const [debtDir, setDebtDir] = useState<'lent' | 'borrowed'>('lent');
  const [title, setTitle] = useState('');
  const [party, setParty] = useState('');
  const [amount, setAmount] = useState('');
  const [count, setCount] = useState('12');
  const [bank, setBank] = useState('');
  const [sayad, setSayad] = useState('');
  const [hasDue, setHasDue] = useState(false);
  const [dueKey, setDueKey] = useState(() => jalaliDayKey(new Date()));

  const styles = useThemedStyles((_c, th) => ({
    body: { paddingHorizontal: th.spacing.lg, paddingBottom: 60, gap: th.spacing.md },
    form: { padding: th.spacing.lg, gap: 16 },
  }));

  const save = () => {
    const amountRial = tomanToRial(Number(amount) || 0);
    const name = (kind === 'installment' ? title : party).trim();
    const total = Number(count) || 0;
    if (amountRial <= 0 || !name || (kind === 'installment' && total <= 0)) {
      appAlert(dict.invalid);
      return;
    }
    const now = new Date().toISOString();
    const dueDate = isoForJalaliDayKey(dueKey);
    const store = useFinanceStore.getState();
    if (kind === 'installment') {
      store.upsertInstallmentPlan({
        id: newObligationId('plan'),
        kind: planKind,
        title: name,
        lender: party.trim() || undefined,
        installmentRial: amountRial,
        totalCount: total,
        firstDueDate: dueDate,
        payments: [],
        createdAt: now,
        updatedAt: now,
      });
    } else if (kind === 'cheque') {
      store.upsertCheque({
        id: newObligationId('chq'),
        direction: chequeDir,
        amountRial,
        dueDate,
        counterparty: name,
        bankName: bank.trim() || undefined,
        sayadId: sayad || undefined,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      });
    } else {
      store.upsertDebt({
        id: newObligationId('debt'),
        person: name,
        direction: debtDir,
        amountRial,
        date: now,
        dueDate: hasDue ? dueDate : undefined,
        note: title.trim() || undefined,
        settlements: [],
        createdAt: now,
        updatedAt: now,
      });
    }
    nav.goBack();
  };

  const kindLabel = (k: Kind) =>
    k === 'installment' ? dict.kindInstallment : k === 'cheque' ? dict.kindCheque : dict.kindDebt;

  return (
    <NightCanvas>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 8 }}>
        <View style={styles.body}>
          <ScreenHeader title={dict.addTitle} onBack={() => nav.goBack()} />
          <SegmentedControl options={KINDS} value={kind} onChange={setKind} labelFor={kindLabel} />
          <GlassPanel strong style={styles.form}>
            {kind === 'installment' ? (
              <>
                <SegmentedControl
                  options={['loan', 'purchase'] as const as ('loan' | 'purchase')[]}
                  value={planKind}
                  onChange={setPlanKind}
                  labelFor={v => (v === 'loan' ? dict.loan : dict.purchase)}
                />
                <TextField label={dict.titleLabel} value={title} onChange={setTitle} placeholder={dict.titlePlaceholder} />
                <TextField label={dict.lender} value={party} onChange={setParty} />
                <AmountField label={dict.installmentAmount} value={amount} onChangeValue={setAmount} />
                <TextField label={dict.count} value={count} onChange={setCount} numeric />
                <DateField label={dict.firstDue} value={dueKey} onChange={setDueKey} />
              </>
            ) : null}
            {kind === 'cheque' ? (
              <>
                <SegmentedControl
                  options={['issued', 'received'] as ('issued' | 'received')[]}
                  value={chequeDir}
                  onChange={setChequeDir}
                  labelFor={v => (v === 'issued' ? dict.issued : dict.received)}
                />
                <TextField label={dict.counterparty} value={party} onChange={setParty} />
                <AmountField label={dict.amount} value={amount} onChangeValue={setAmount} />
                <DateField label={dict.dueDate} value={dueKey} onChange={setDueKey} />
                <TextField label={dict.bank} value={bank} onChange={setBank} />
                <TextField label={dict.sayad} value={sayad} onChange={v => setSayad(v.slice(0, 16))} numeric />
              </>
            ) : null}
            {kind === 'debt' ? (
              <>
                <SegmentedControl
                  options={['lent', 'borrowed'] as ('lent' | 'borrowed')[]}
                  value={debtDir}
                  onChange={setDebtDir}
                  labelFor={v => (v === 'lent' ? dict.lent : dict.borrowed)}
                />
                <TextField label={dict.person} value={party} onChange={setParty} />
                <AmountField label={dict.amount} value={amount} onChangeValue={setAmount} />
                <View style={{ flexDirection: 'row-reverse' }}>
                  <FilterChip label={dict.hasDue} active={hasDue} onPress={() => setHasDue(v => !v)} />
                </View>
                {hasDue ? <DateField label={dict.dueDate} value={dueKey} onChange={setDueKey} /> : null}
              </>
            ) : null}
          </GlassPanel>
          <PrimaryButton label={dict.save} onPress={save} />
        </View>
      </ScrollView>
    </NightCanvas>
  );
}
