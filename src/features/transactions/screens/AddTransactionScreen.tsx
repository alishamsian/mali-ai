import React, { useEffect, useMemo, useState } from 'react';
import { Keyboard, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, X } from 'lucide-react-native';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { AppText } from '../../../components/ui/AppText';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { PressScale } from '../../../components/ui/PressScale';
import { AlertBanner } from '../../../components/ui/AlertBanner';
import { Badge } from '../../../components/ui/Badge';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { theme } from '../../../theme';
import { AmountKeypad } from '../components/AmountKeypad';
import { interpolate, t } from '../../../i18n';
import { useFinanceStore } from '../../../store/finance/store';
import { formatTomanFromRial, tomanToRial } from '../../../utils/currency/money';
import { parseIntegerAmount, toPersianDigits } from '../../../utils/numbers/digits';
import { tomanToPersianWords } from '../../../utils/numbers/persianWords';
import {
  isoForJalaliDayKey,
  jalaliDayLabel,
  shiftJalaliDayKey,
  todayJalaliKey,
} from '../../../utils/dates/jalali';
import { categorize } from '../../../engine/category/engine';
import { buildFingerprint } from '../../../engine/duplicate/fingerprint';
import { hapticSuccess, hapticWarn } from '../../../utils/haptics';
import { AccountPickerField } from '../../accounts/components/AccountPickerField';
import { CategoryPickerField } from '../components/CategoryPickerField';
import { EXPENSE_CATEGORIES } from '../../../constants/categories';
import { INCOME_SOURCE_IDS, type IncomeSourceId } from '../../../constants/incomeSources';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { CategoryId, Transaction, TransactionType } from '../../../types/finance';
import type { RootStackParamList } from '../../../app/navigation/types';

type Mode = 'expense' | 'income' | 'transfer' | 'receipt';

/** Keypad (4 rows) + save button + paddings; the scroll area keeps clear of it. */
const FOOTER_HEIGHT = 330;
/** Shown as one-tap chips; the full list stays in «جزئیات بیشتر». */
const QUICK_CATEGORIES: CategoryId[] = ['food', 'shopping', 'transport', 'bills'];

function recentMerchants(transactions: Transaction[], limit = 6): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const sorted = [...transactions].sort((a, b) =>
    b.transactionDate.localeCompare(a.transactionDate),
  );
  for (const tx of sorted) {
    const name = tx.merchant?.trim();
    if (!name || seen.has(name)) {
      continue;
    }
    seen.add(name);
    result.push(name);
    if (result.length >= limit) {
      break;
    }
  }
  return result;
}

export function AddTransactionScreen({
  navigation,
  route,
}: {
  navigation: NativeStackNavigationProp<RootStackParamList>;
  route: RouteProp<RootStackParamList, 'AddTransaction'>;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  const snapshot = useFinanceStore(s => s.snapshot);
  const add = useFinanceStore(s => s.addTransaction);
  const remove = useFinanceStore(s => s.deleteTransaction);
  const upsertAccount = useFinanceStore(s => s.upsertAccount);
  const dict = t();

  const isReceipt = route.params?.mode === 'receipt';
  const initialMode = (route.params?.mode ?? 'expense') as Mode;
  const [mode, setMode] = useState<Mode>(initialMode === 'receipt' ? 'expense' : initialMode);
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [dayKey, setDayKey] = useState(route.params?.dayKey ?? todayJalaliKey());
  const [formError, setFormError] = useState<string | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [autoSuggested, setAutoSuggested] = useState(false);
  const [incomeSource, setIncomeSource] = useState<IncomeSourceId>('salary');
  const [showDetails, setShowDetails] = useState(isReceipt);
  /** Ids written by the last save, kept so «برگرداندن» can undo it. */
  const [savedIds, setSavedIds] = useState<string[] | null>(null);

  const [accountId, setAccountId] = useState(() => {
    const def = snapshot.settings.defaultAccountId;
    if (def && snapshot.accounts.some(a => a.id === def)) {
      return def;
    }
    return snapshot.accounts[0]?.id ?? 'acc_cash';
  });
  const [toAccountId, setToAccountId] = useState(() => {
    const first = snapshot.accounts[0]?.id ?? 'acc_cash';
    const second = snapshot.accounts.find(a => a.id !== first)?.id;
    return second ?? first;
  });
  const [categoryId, setCategoryId] = useState<CategoryId>(
    initialMode === 'income' ? 'income' : 'food',
  );

  const accounts = snapshot.accounts.filter(
    a => a.kind === 'bank' || a.kind === 'cash' || a.kind === 'card',
  );
  const usableAccounts = accounts.length > 0 ? accounts : snapshot.accounts;

  const amountToman = parseIntegerAmount(amount);
  const amountWords = tomanToPersianWords(amountToman);
  const todayKey = todayJalaliKey();
  const yesterdayKey = shiftJalaliDayKey(todayKey, -1);
  const isCustomDay = dayKey !== todayKey;

  const tone = mode === 'income' ? colors.income : colors.text;

  const saveLabel =
    mode === 'income'
      ? dict.add.saveIncome
      : mode === 'transfer'
      ? dict.add.saveTransfer
      : dict.add.saveExpense;

  const merchantSuggestions = useMemo(
    () => recentMerchants(snapshot.transactions),
    [snapshot.transactions],
  );

  const modes = useMemo(
    () =>
      [
        { id: 'expense' as const, label: dict.add.expense },
        { id: 'income' as const, label: dict.add.income },
        { id: 'transfer' as const, label: dict.add.transfer },
      ] as const,
    [dict],
  );

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, e => {
      setKeyboardInset(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      setKeyboardInset(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (mode === 'income') {
      setCategoryId('income');
      setAutoSuggested(false);
      return;
    }
    if (mode === 'transfer') {
      setAutoSuggested(false);
      return;
    }
    // Coming back from income/transfer must not leave an expense filed as «درآمد».
    if (categoryId === 'income' || categoryId === 'transfer') {
      setCategoryId('food');
    }
    if (categoryTouched) {
      return;
    }
    const suggested = categorize({
      merchant,
      description: notes,
      type: 'purchase',
      userRules: snapshot.rules,
    });
    if (suggested !== 'other' && suggested !== 'income' && suggested !== 'transfer') {
      setCategoryId(suggested);
      setAutoSuggested(true);
    } else {
      setAutoSuggested(false);
    }
  }, [merchant, mode, notes, snapshot.rules, categoryTouched, categoryId]);

  useEffect(() => {
    if (mode === 'transfer' && toAccountId === accountId) {
      const alt = usableAccounts.find(a => a.id !== accountId);
      if (alt) {
        setToAccountId(alt.id);
      }
    }
  }, [accountId, mode, toAccountId, usableAccounts]);

  const clearError = () => {
    if (formError) {
      setFormError(null);
    }
  };

  const onAmountChange = (next: string) => {
    clearError();
    setAmount(next);
  };

  const account = usableAccounts.find(a => a.id === accountId);
  const amountRialPreview = amountToman ? tomanToRial(amountToman) : 0;
  const balanceAfterRial = account
    ? account.balanceRial + (mode === 'income' ? amountRialPreview : -amountRialPreview)
    : null;

  const resetForm = () => {
    setSavedIds(null);
    setAmount('');
    setMerchant('');
    setNotes('');
    setCategoryTouched(false);
  };

  const undoSave = () => {
    savedIds?.forEach(id => remove(id));
    setSavedIds(null);
  };

  const save = () => {
    const toman = parseIntegerAmount(amount);
    if (!toman) {
      hapticWarn();
      setFormError(dict.add.needAmount);
      return;
    }
    // No account yet (fresh install, SMS not connected): create a real cash wallet rather
    // than filing the entry under a demo id that startup cleanup would delete.
    let targetAccountId = accountId;
    if (!usableAccounts.some(a => a.id === accountId) && mode !== 'transfer') {
      const now = new Date().toISOString();
      targetAccountId = `acc_wallet_${Date.now()}`;
      upsertAccount({
        id: targetAccountId,
        userId: snapshot.profile.id,
        kind: 'cash',
        bankId: 'cash',
        name: dict.add.walletName,
        balanceRial: 0,
        transactionCount: 0,
        createdAt: now,
        updatedAt: now,
        assetClass: 'cash',
        liquidity: 'high',
      });
      setAccountId(targetAccountId);
    }
    if (!targetAccountId) {
      hapticWarn();
      setFormError(dict.add.needAccount);
      return;
    }
    if (mode === 'transfer' && accountId === toAccountId) {
      hapticWarn();
      setFormError(dict.add.sameAccount);
      return;
    }

    const amountRial = tomanToRial(toman);
    const txDate = isoForJalaliDayKey(dayKey);
    const isTransfer = mode === 'transfer';
    const isIncome = mode === 'income';
    const type: TransactionType = isTransfer ? 'transfer' : isIncome ? 'deposit' : 'purchase';
    const direction = isTransfer ? 'internal' : isIncome ? 'in' : 'out';
    const resolvedCategory: CategoryId = isTransfer ? 'transfer' : isIncome ? 'income' : categoryId;

    const resolvedMerchant = isIncome
      ? dict.add.incomeSources[incomeSource]
      : merchant.trim() || undefined;

    const mk = (
      id: string,
      acc: string,
      dir: 'in' | 'out' | 'internal',
      extra?: { type?: TransactionType; direction?: 'in' | 'out' | 'internal' },
    ) => ({
      id,
      userId: snapshot.profile.id,
      accountId: acc,
      type,
      direction: dir,
      amountRial,
      currency: 'IRR' as const,
      merchant: resolvedMerchant,
      notes: notes.trim() || undefined,
      categoryId: resolvedCategory,
      transactionDate: txDate,
      source: 'manual' as const,
      fingerprint: buildFingerprint({
        userId: snapshot.profile.id,
        type,
        amountRial,
        date: txDate,
        source: 'manual',
        normalizedText: `${resolvedMerchant ?? ''}:${acc}:${dir}`,
      }),
      confidence: 1,
      isConfirmed: true,
      needsReview: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...extra,
    });

    const stamp = Date.now();
    const ids = isTransfer ? [`tx_${stamp}_out`, `tx_${stamp}_in`] : [`tx_${stamp}`];
    if (isTransfer) {
      add(mk(ids[0], accountId, 'out', { direction: 'out', type: 'withdrawal' }));
      add(mk(ids[1], toAccountId, 'in', { direction: 'in', type: 'deposit' }));
    } else {
      add(mk(ids[0], targetAccountId, direction));
    }
    hapticSuccess();
    Keyboard.dismiss();
    setSavedIds(ids);
  };

  const chip = (label: string, on: boolean, onPress: () => void, key?: string) => (
    <PressScale key={key ?? label} onPress={onPress} accessibilityState={{ selected: on }}>
      <GlassPanel
        strong
        radius={999}
        style={[
          styles.chip,
          on && { backgroundColor: colors.primary, borderColor: colors.primary },
        ]}>
        <AppText
          style={[styles.chipText, { color: on ? colors.onPrimary : colors.text }]}
          numberOfLines={1}>
          {label}
        </AppText>
      </GlassPanel>
    </PressScale>
  );

  const saveText = amountToman
    ? `${saveLabel} · ${formatTomanFromRial(tomanToRial(amountToman))} ${dict.common.toman}`
    : dict.add.enterAmountFirst;
  // Details hold text fields; the keypad steps aside so nothing slides under the glass.
  const keypadVisible = keyboardInset === 0 && !showDetails;

  return (
    <NightCanvas>
      <View style={styles.flex}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.flex}
          contentContainerStyle={{
            paddingTop: insets.top + 8,
            paddingHorizontal: 16,
            paddingBottom: (keypadVisible ? FOOTER_HEIGHT : 90) + insets.bottom + 16,
            gap: 12,
          }}>
          <View style={styles.header}>
            <PressScale onPress={() => navigation.goBack()} accessibilityLabel={dict.add.close}>
              <GlassPanel strong radius={16} style={styles.iconBtn}>
                <X color={colors.text} size={20} strokeWidth={2} />
              </GlassPanel>
            </PressScale>
            <AppText style={[styles.title, { color: colors.text }]}>{dict.add.screenTitle}</AppText>
            <View style={[styles.brandTile, { backgroundColor: colors.primary }]}>
              <AppText style={[styles.brandGlyph, { color: colors.onPrimary }]}>پ</AppText>
            </View>
          </View>

          {isReceipt ? <AlertBanner tone="info" message={dict.add.receiptHint} /> : null}

          <GlassPanel radius={999} style={styles.segment} accessibilityRole="tablist">
            {modes.map(item => {
              const on = mode === item.id;
              return (
                <PressScale
                  key={item.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    clearError();
                    setMode(item.id);
                  }}
                  style={[styles.segmentItem, on && { backgroundColor: colors.primary }]}>
                  <AppText
                    style={[styles.segmentLabel, { color: on ? colors.onPrimary : colors.text }]}>
                    {item.label}
                  </AppText>
                </PressScale>
              );
            })}
          </GlassPanel>

          <PressScale
            onPress={() => setShowDetails(false)}
            accessibilityLabel={dict.transactions.amount}>
            <GlassPanel radius={30} style={styles.amountCard} accessibilityLiveRegion="polite">
              <View style={styles.amountRow}>
                <AppText style={[styles.unit, { color: colors.textSecondary }]}>
                  {dict.common.toman}
                </AppText>
                <View style={[styles.caret, { backgroundColor: colors.text }]} />
                <AppText
                  style={[styles.amount, { color: amountToman ? tone : colors.textMuted }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  accessibilityLabel={dict.transactions.amount}>
                  {amountToman
                    ? formatTomanFromRial(tomanToRial(amountToman))
                    : toPersianDigits('0')}
                </AppText>
              </View>
              <AppText style={[styles.words, { color: colors.textSecondary }]}>
                {amountToman ? amountWords : dict.add.amountHint}
              </AppText>
            </GlassPanel>
          </PressScale>

          {mode === 'expense' ? (
            <View style={styles.chipWrap}>
              {QUICK_CATEGORIES.map(id =>
                chip(
                  dict.categories[id],
                  categoryId === id,
                  () => {
                    clearError();
                    setCategoryTouched(true);
                    setAutoSuggested(false);
                    setCategoryId(id);
                  },
                  id,
                ),
              )}
              {QUICK_CATEGORIES.includes(categoryId)
                ? null
                : chip(dict.categories[categoryId], true, () => setShowDetails(true), categoryId)}
            </View>
          ) : null}
          {mode === 'income' ? (
            <View style={styles.chipWrap}>
              {INCOME_SOURCE_IDS.map(id =>
                chip(
                  dict.add.incomeSources[id],
                  incomeSource === id,
                  () => setIncomeSource(id),
                  id,
                ),
              )}
            </View>
          ) : null}

          <View style={styles.metaRow}>
            <PressScale style={styles.flex} onPress={() => setShowDetails(true)}>
              <GlassPanel strong radius={16} style={styles.metaPill}>
                <AppText style={[styles.metaText, { color: colors.text }]} numberOfLines={1}>
                  <AppText style={styles.metaStrong}>
                    {account?.name ?? dict.add.pickAccount}
                  </AppText>
                  {balanceAfterRial != null ? (
                    <AppText style={{ color: colors.textMuted }}>
                      {' · '}
                      {dict.add.balanceAfter}{' '}
                      <AppText style={[styles.metaStrong, { color: colors.text }]}>
                        {formatTomanFromRial(balanceAfterRial)}
                      </AppText>
                    </AppText>
                  ) : null}
                </AppText>
              </GlassPanel>
            </PressScale>
            {chip(
              dayKey === todayKey
                ? dict.add.today
                : dayKey === yesterdayKey
                ? dict.add.yesterday
                : jalaliDayLabel(dayKey),
              true,
              () => setDayKey(dayKey === todayKey ? yesterdayKey : todayKey),
            )}
          </View>

          <PressScale onPress={() => setShowDetails(v => !v)} style={styles.detailsToggle}>
            <AppText style={[styles.detailsToggleText, { color: colors.textSecondary }]}>
              {showDetails ? dict.add.lessDetails : dict.add.moreDetails}
            </AppText>
            {showDetails ? (
              <ChevronUp color={colors.textSecondary} size={16} />
            ) : (
              <ChevronDown color={colors.textSecondary} size={16} />
            )}
          </PressScale>

          {showDetails ? (
            <GlassPanel radius={26} style={styles.details}>
              {mode !== 'income' && mode !== 'transfer' ? (
                <>
                  <TextInput
                    value={merchant}
                    onChangeText={v => {
                      clearError();
                      setMerchant(v);
                    }}
                    placeholder={dict.add.merchantHint}
                    placeholderTextColor={colors.textMuted}
                    textAlign="right"
                    style={[
                      styles.field,
                      {
                        color: colors.text,
                        backgroundColor: colors.glassStrong,
                        borderColor: colors.glassBorder,
                      },
                    ]}
                  />
                  {merchantSuggestions.length > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.chipRow}>
                      {merchantSuggestions.map(name =>
                        chip(name, merchant === name, () => setMerchant(name)),
                      )}
                    </ScrollView>
                  ) : null}
                </>
              ) : null}
              <AccountPickerField
                label={mode === 'transfer' ? dict.add.fromAccount : dict.add.pickAccount}
                accounts={usableAccounts}
                selectedId={accountId}
                onSelect={id => {
                  clearError();
                  setAccountId(id);
                }}
              />
              {mode === 'transfer' ? (
                <AccountPickerField
                  label={dict.add.toAccount}
                  accounts={usableAccounts}
                  selectedId={toAccountId}
                  onSelect={id => {
                    clearError();
                    setToAccountId(id);
                  }}
                  excludeId={accountId}
                />
              ) : null}
              {mode === 'expense' ? (
                <View style={styles.gap8}>
                  <View style={styles.labelRow}>
                    <AppText style={[styles.fieldLabel, { color: colors.textMuted }]}>
                      {dict.add.pickCategory}
                    </AppText>
                    {autoSuggested && !categoryTouched ? (
                      <Badge label={dict.add.autoCategory} tone="brand" />
                    ) : null}
                  </View>
                  <CategoryPickerField
                    categories={EXPENSE_CATEGORIES}
                    selectedId={categoryId}
                    onSelect={id => {
                      if (id !== 'all') {
                        clearError();
                        setCategoryTouched(true);
                        setAutoSuggested(false);
                        setCategoryId(id);
                      }
                    }}
                  />
                </View>
              ) : null}
              <View style={styles.dateRow}>
                <PressScale
                  onPress={() => setDayKey(shiftJalaliDayKey(dayKey, -1))}
                  accessibilityLabel={dict.add.prevDay}>
                  <GlassPanel strong radius={14} style={styles.dayBtn}>
                    <ChevronRight color={colors.text} size={18} />
                  </GlassPanel>
                </PressScale>
                <AppText style={[styles.dateLabel, { color: colors.text }]}>
                  {isCustomDay
                    ? interpolate(dict.add.forDay, { day: jalaliDayLabel(dayKey) })
                    : jalaliDayLabel(dayKey)}
                </AppText>
                <PressScale
                  onPress={() => setDayKey(shiftJalaliDayKey(dayKey, 1))}
                  accessibilityLabel={dict.add.nextDay}>
                  <GlassPanel strong radius={14} style={styles.dayBtn}>
                    <ChevronLeft color={colors.text} size={18} />
                  </GlassPanel>
                </PressScale>
              </View>
              <TextInput
                value={notes}
                onChangeText={v => {
                  clearError();
                  setNotes(v);
                }}
                placeholder={dict.add.notesHint}
                placeholderTextColor={colors.textMuted}
                textAlign="right"
                multiline
                style={[
                  styles.field,
                  styles.notes,
                  {
                    color: colors.text,
                    backgroundColor: colors.glassStrong,
                    borderColor: colors.glassBorder,
                  },
                ]}
              />
            </GlassPanel>
          ) : null}
        </ScrollView>

        <View
          style={[
            styles.footer,
            { bottom: keyboardInset, paddingBottom: keyboardInset > 0 ? 10 : insets.bottom + 10 },
          ]}>
          {keypadVisible ? <AmountKeypad value={amount} onChange={onAmountChange} /> : null}
          {formError ? (
            <AppText style={[styles.error, { color: colors.warning }]}>{formError}</AppText>
          ) : null}
          <PressScale
            onPress={save}
            accessibilityRole="button"
            accessibilityState={{ disabled: !amountToman }}
            style={[
              styles.saveBtn,
              { backgroundColor: colors.primary, opacity: amountToman ? 1 : 0.4 },
            ]}>
            <Check color={colors.onPrimary} size={20} strokeWidth={2.6} />
            <AppText style={[styles.saveText, { color: colors.onPrimary }]} numberOfLines={1}>
              {saveText}
            </AppText>
          </PressScale>
        </View>

        {savedIds ? (
          <View style={styles.sheetBackdrop}>
            <GlassPanel
              radius={32}
              style={[
                styles.sheet,
                { backgroundColor: colors.glassStrong, marginBottom: insets.bottom + 12 },
              ]}>
              <View style={[styles.sheetIcon, { backgroundColor: colors.primary }]}>
                <Check color={colors.onPrimary} size={26} strokeWidth={2.6} />
              </View>
              <AppText style={[styles.sheetTitle, { color: colors.text }]}>
                {dict.add.saved}
              </AppText>
              <AppText style={[styles.sheetLine, { color: colors.textSecondary }]}>
                {formatTomanFromRial(tomanToRial(amountToman ?? 0))} {dict.common.toman} ·{' '}
                {mode === 'expense' ? dict.categories[categoryId] : saveLabel} ·{' '}
                {account?.name ?? ''}
              </AppText>
              <View style={styles.sheetActions}>
                <PressScale style={styles.flex} onPress={undoSave}>
                  <GlassPanel strong radius={16} style={styles.sheetBtn}>
                    <AppText style={[styles.sheetBtnText, { color: colors.text }]}>
                      {dict.add.undo}
                    </AppText>
                  </GlassPanel>
                </PressScale>
                <PressScale style={styles.flex} onPress={resetForm}>
                  <GlassPanel strong radius={16} style={styles.sheetBtn}>
                    <AppText style={[styles.sheetBtnText, { color: colors.text }]}>
                      {dict.add.another}
                    </AppText>
                  </GlassPanel>
                </PressScale>
                <PressScale
                  style={[
                    styles.flex,
                    styles.sheetBtn,
                    { backgroundColor: colors.primary, borderRadius: 16 },
                  ]}
                  onPress={() => navigation.goBack()}>
                  <AppText style={[styles.sheetBtnText, { color: colors.onPrimary }]}>
                    {dict.add.done}
                  </AppText>
                </PressScale>
              </View>
            </GlassPanel>
          </View>
        ) : null}
      </View>
    </NightCanvas>
  );
}

const rtl = { textAlign: 'right' as const, writingDirection: 'rtl' as const };

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap8: { gap: 8 },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontFamily: theme.typography.fontFamily.semibold, textAlign: 'center' },
  brandTile: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandGlyph: { fontSize: 28, lineHeight: 40, fontFamily: theme.typography.fontFamily.bold },
  segment: { alignSelf: 'center', flexDirection: 'row-reverse', padding: 4, gap: 4 },
  segmentItem: {
    height: 40,
    paddingHorizontal: 20,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentLabel: { fontSize: 14, fontFamily: theme.typography.fontFamily.semibold },
  amountCard: { alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16, gap: 4 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' },
  amount: {
    fontSize: 46,
    lineHeight: 60,
    letterSpacing: -1,
    fontFamily: theme.typography.fontFamily.semibold,
    writingDirection: 'ltr',
    flexShrink: 1,
  },
  caret: { width: 2, height: 40, borderRadius: 1 },
  unit: { fontSize: 15 },
  words: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    writingDirection: 'rtl',
    minHeight: 20,
  },
  chipRow: { flexDirection: 'row-reverse', gap: 6, paddingHorizontal: 2 },
  chipWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 },
  chip: { height: 40, paddingHorizontal: 14, justifyContent: 'center' },
  chipText: { fontSize: 13, fontFamily: theme.typography.fontFamily.semibold },
  metaRow: { flexDirection: 'row-reverse', gap: 8, alignItems: 'center' },
  metaPill: { height: 44, paddingHorizontal: 14, justifyContent: 'center' },
  metaText: { ...rtl, fontSize: 13 },
  metaStrong: { fontFamily: theme.typography.fontFamily.bold },
  detailsToggle: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 44,
  },
  detailsToggleText: { fontSize: 13, fontFamily: theme.typography.fontFamily.medium },
  details: { padding: 12, gap: 12 },
  field: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: 15,
  },
  notes: { minHeight: 72, paddingTop: 12, textAlignVertical: 'top' },
  labelRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  fieldLabel: { ...rtl, flex: 1, fontSize: 12 },
  dateRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  dayBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dateLabel: {
    flex: 1,
    fontSize: 14,
    textAlign: 'center',
    fontFamily: theme.typography.fontFamily.semibold,
  },
  footer: { position: 'absolute', left: 0, right: 0, paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  error: { textAlign: 'center', fontSize: 13, fontFamily: theme.typography.fontFamily.semibold },
  saveBtn: {
    height: 58,
    borderRadius: 20,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  saveText: { fontSize: 16, fontFamily: theme.typography.fontFamily.bold, flexShrink: 1 },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(221,227,229,0.6)',
  },
  sheet: {
    alignItems: 'center',
    gap: 10,
    paddingTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sheetIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: { fontSize: 18, fontFamily: theme.typography.fontFamily.bold },
  sheetLine: { fontSize: 14, textAlign: 'center', writingDirection: 'rtl' },
  sheetActions: { flexDirection: 'row-reverse', gap: 8, alignSelf: 'stretch', marginTop: 6 },
  sheetBtn: { height: 48, alignItems: 'center', justifyContent: 'center' },
  sheetBtnText: { fontSize: 14, fontFamily: theme.typography.fontFamily.semibold },
});
