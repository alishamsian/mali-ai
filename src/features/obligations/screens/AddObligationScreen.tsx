import { appAlert } from '../../../components/ui/AppAlert';
import React, { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  Banknote,
  CalendarClock,
  Car,
  GraduationCap,
  HeartHandshake,
  Home,
  Landmark,
  ShieldCheck,
  ShoppingBag,
  Wifi,
} from 'lucide-react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppText } from '../../../components/ui/AppText';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { PressScale } from '../../../components/ui/PressScale';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { FilterChip } from '../../../components/ui/FilterChip';
import { JalaliDateField } from '../../../components/ui/JalaliDateField';
import { AmountField } from '../../../components/ui/AmountInput';
import { t } from '../../../i18n';
import { useFinanceStore } from '../../../store/finance/store';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { tomanToRial } from '../../../utils/currency/money';
import { toEnglishDigits, toPersianDigits } from '../../../utils/numbers/digits';
import { isoForJalaliDayKey, jalaliDayKey, toJalaliLabel } from '../../../utils/dates/jalali';
import { installmentDueDate } from '../../../engine/obligations/schedule';
import { interpolate } from '../../../i18n';
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

type Template = {
  key: string;
  Icon: typeof Home;
  kind: 'loan' | 'purchase';
  /** Repeats every month with no end. */
  recurring: boolean;
};

/** Common monthly obligations; picking one fills the form and leaves only the amount. */
const TEMPLATES: Template[] = [
  { key: 'rent', Icon: Home, kind: 'purchase', recurring: true },
  { key: 'loan', Icon: Landmark, kind: 'loan', recurring: false },
  { key: 'car', Icon: Car, kind: 'loan', recurring: false },
  { key: 'tuition', Icon: GraduationCap, kind: 'purchase', recurring: true },
  { key: 'insurance', Icon: ShieldCheck, kind: 'purchase', recurring: true },
  { key: 'internet', Icon: Wifi, kind: 'purchase', recurring: true },
  { key: 'charity', Icon: HeartHandshake, kind: 'purchase', recurring: true },
  { key: 'purchase', Icon: ShoppingBag, kind: 'purchase', recurring: false },
];

const KIND_ICON = { installment: CalendarClock, cheque: Banknote, debt: Landmark } as const;

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
  const [recurring, setRecurring] = useState(false);
  const [template, setTemplate] = useState<string | null>(null);
  const { colors } = useAppTheme();

  const styles = useThemedStyles((c, th) => ({
    body: { paddingHorizontal: th.spacing.lg, paddingBottom: 60, gap: th.spacing.md },
    form: { padding: th.spacing.lg, gap: 16 },
    kinds: { flexDirection: 'row-reverse', gap: 10 },
    kindCard: {
      flex: 1,
      alignItems: 'center',
      gap: 6,
      paddingVertical: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.glassBorder,
      backgroundColor: c.glassStrong,
    },
    kindText: { fontSize: 13, color: c.text, fontFamily: th.typography.fontFamily.medium },
    section: { textAlign: 'right', color: c.textSecondary, fontSize: 12.5 },
    templates: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
    tpl: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      minHeight: 40,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.glassBorder,
      backgroundColor: c.glass,
    },
    tplText: { fontSize: 13, color: c.text },
    preview: { padding: 12, borderRadius: 14, backgroundColor: c.glass, gap: 2 },
    previewText: { textAlign: 'right', color: c.textSecondary, fontSize: 12.5, lineHeight: 21 },
  }));

  const pickTemplate = (tpl: Template) => {
    setTemplate(tpl.key);
    setPlanKind(tpl.kind);
    setRecurring(tpl.recurring);
    setTitle(dict.templates[tpl.key as keyof typeof dict.templates]);
  };
  // What the schedule will look like, so a typo in the day or count shows before saving.
  const previewText = (() => {
    if (kind !== 'installment' || !(Number(amount) > 0)) {
      return null;
    }
    const first = isoForJalaliDayKey(dueKey);
    if (recurring) {
      return interpolate(dict.previewRecurring, { first: toJalaliLabel(first) });
    }
    const total = Number(count) || 0;
    if (total <= 0) {
      return null;
    }
    return interpolate(dict.previewFixed, {
      n: toPersianDigits(total),
      first: toJalaliLabel(first),
      last: toJalaliLabel(installmentDueDate({ firstDueDate: first }, total - 1)),
    });
  })();

  const save = () => {
    const amountRial = tomanToRial(Number(amount) || 0);
    const name = (kind === 'installment' ? title : party).trim();
    const total = Number(count) || 0;
    if (amountRial <= 0 || !name || (kind === 'installment' && !recurring && total <= 0)) {
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
        totalCount: recurring ? 1 : total,
        openEnded: recurring || undefined,
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
          <View style={styles.kinds}>
            {KINDS.map(k => {
              const Icon = KIND_ICON[k];
              const active = kind === k;
              return (
                <PressScale
                  key={k}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setKind(k)}
                  style={[
                    styles.kindCard,
                    active && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}>
                  <Icon size={22} color={active ? colors.onPrimary : colors.text} />
                  <AppText style={[styles.kindText, active && { color: colors.onPrimary }]}>
                    {kindLabel(k)}
                  </AppText>
                </PressScale>
              );
            })}
          </View>
          <GlassPanel strong style={styles.form}>
            {kind === 'installment' ? (
              <>
                <AppText style={styles.section}>{dict.templatesTitle}</AppText>
                <View style={styles.templates}>
                  {TEMPLATES.map(tpl => (
                    <PressScale
                      key={tpl.key}
                      accessibilityRole="button"
                      onPress={() => pickTemplate(tpl)}
                      style={[
                        styles.tpl,
                        template === tpl.key && { borderColor: colors.primary, borderWidth: 1.5 },
                      ]}>
                      <tpl.Icon size={16} color={colors.textSecondary} />
                      <AppText style={styles.tplText}>
                        {dict.templates[tpl.key as keyof typeof dict.templates]}
                      </AppText>
                    </PressScale>
                  ))}
                </View>
                <TextField
                  label={dict.titleLabel}
                  value={title}
                  onChange={setTitle}
                  placeholder={dict.titlePlaceholder}
                />
                <AmountField
                  label={dict.installmentAmount}
                  value={amount}
                  onChangeValue={setAmount}
                />
                <JalaliDateField label={dict.firstDue} value={dueKey} onChange={setDueKey} />
                <SegmentedControl
                  options={['fixed', 'monthly'] as ('fixed' | 'monthly')[]}
                  value={recurring ? 'monthly' : 'fixed'}
                  onChange={v => setRecurring(v === 'monthly')}
                  labelFor={v => (v === 'fixed' ? dict.repeatFixed : dict.repeatMonthly)}
                />
                {!recurring ? (
                  <TextField label={dict.count} value={count} onChange={setCount} numeric />
                ) : null}
                <TextField label={dict.lender} value={party} onChange={setParty} />
                {previewText ? (
                  <View style={styles.preview}>
                    <AppText style={styles.previewText}>{previewText}</AppText>
                  </View>
                ) : null}
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
                <JalaliDateField label={dict.dueDate} value={dueKey} onChange={setDueKey} />
                <TextField label={dict.bank} value={bank} onChange={setBank} />
                <TextField
                  label={dict.sayad}
                  value={sayad}
                  onChange={v => setSayad(v.slice(0, 16))}
                  numeric
                />
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
                  <FilterChip
                    label={dict.hasDue}
                    active={hasDue}
                    onPress={() => setHasDue(v => !v)}
                  />
                </View>
                {hasDue ? (
                  <JalaliDateField label={dict.dueDate} value={dueKey} onChange={setDueKey} />
                ) : null}
              </>
            ) : null}
          </GlassPanel>
          <PrimaryButton label={dict.save} onPress={save} />
        </View>
      </ScrollView>
    </NightCanvas>
  );
}
