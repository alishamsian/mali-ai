import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronRight, MessageSquareWarning, Trash2 } from 'lucide-react-native';
import { AppText } from '../../../components/ui/AppText';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { PressScale } from '../../../components/ui/PressScale';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { categoryIcons } from '../../../components/lists/TransactionRow';
import { interpolate, t } from '../../../i18n';
import { formatTomanFromRial } from '../../../utils/currency/money';
import { toPersianDigits } from '../../../utils/numbers/digits';
import { jalaliDayKey, jalaliDayLabel, toTimeLabel } from '../../../utils/dates/jalali';
import { hapticSuccess, hapticTap } from '../../../utils/haptics';
import { selectReviewItems, useFinanceStore } from '../../../store/finance/store';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { theme } from '../../../theme';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../app/navigation/types';
import type { CategoryId, Transaction, UnknownSmsRecord } from '../../../types/finance';

/** One tap files the transaction; the full list is behind «بیشتر» (details screen). */
const QUICK_CATEGORIES: CategoryId[] = ['food', 'shopping', 'transport', 'bills'];
const UNDO_MS = 5000;

type Row =
  | { kind: 'header'; id: string; title: string }
  | { kind: 'tx'; id: string; tx: Transaction }
  | { kind: 'unknown'; id: string; item: UnknownSmsRecord };

type Undo = { label: string; restore: () => void };

function reasonLabel(code: string, dict: ReturnType<typeof t>): string {
  if (code === 'bank_not_detected') {
    return dict.sms.reasonBankNotDetected;
  }
  if (code === 'PARSER_CONFLICT') {
    return dict.sms.reasonConflict;
  }
  if (code === 'NOT_IMPLEMENTED' || code === 'NEEDS_FIXTURES') {
    return dict.sms.reasonNotImplemented;
  }
  return dict.sms.reasonOther;
}

export function ReviewInboxScreen({
  navigation,
}: {
  navigation: NativeStackNavigationProp<RootStackParamList>;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const snapshot = useFinanceStore(s => s.snapshot);
  const confirm = useFinanceStore(s => s.confirmTransaction);
  const recategorize = useFinanceStore(s => s.recategorizeTransaction);
  const update = useFinanceStore(s => s.updateTransaction);
  const remove = useFinanceStore(s => s.deleteTransaction);
  const add = useFinanceStore(s => s.addTransaction);
  const dismiss = useFinanceStore(s => s.dismissUnknown);
  const dict = t();
  const hidden = snapshot.settings.hideBalances;
  const { transactions, unknown } = useMemo(() => selectReviewItems(snapshot), [snapshot]);
  const accountName = useCallback(
    (id: string) => snapshot.accounts.find(a => a.id === id)?.name ?? dict.banks.generic,
    [snapshot.accounts, dict.banks.generic],
  );

  const [undo, setUndo] = useState<Undo | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offerUndo = useCallback((next: Undo) => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    setUndo(next);
    timer.current = setTimeout(() => setUndo(null), UNDO_MS);
  }, []);
  useEffect(() => () => (timer.current ? clearTimeout(timer.current) : undefined), []);

  /** Snapshot of the review fields so «برگرداندن» puts the item back exactly as it was. */
  const restoreRule = useFinanceStore(s => s.restoreMerchantRule);
  const restoreReview = useCallback(
    (txs: Transaction[]) => () => {
      for (const tx of txs) {
        update(tx.id, {
          categoryId: tx.categoryId,
          isConfirmed: tx.isConfirmed,
          needsReview: tx.needsReview,
          confidence: tx.confidence,
        });
      }
    },
    [update],
  );

  const onConfirm = useCallback(
    (tx: Transaction, categoryId?: CategoryId) => {
      hapticSuccess();
      if (categoryId && categoryId !== tx.categoryId) {
        // Also teaches a merchant rule, so the next SMS from here is filed automatically.
        const merchant = tx.merchant?.trim();
        const previousRule = merchant ? snapshot.rules.find(r => r.matcher === merchant) : undefined;
        recategorize(tx.id, categoryId);
        offerUndo({
          label: interpolate(dict.sms.recategorizedToast, { cat: dict.categories[categoryId] }),
          restore: () => {
            restoreReview([tx])();
            if (merchant) {
              restoreRule(merchant, previousRule);
            }
          },
        });
      } else {
        confirm(tx.id);
        offerUndo({ label: dict.sms.confirmedToast, restore: restoreReview([tx]) });
      }
    },
    [confirm, dict, offerUndo, recategorize, restoreReview, restoreRule, snapshot.rules],
  );

  const onDelete = useCallback(
    (tx: Transaction) => {
      hapticTap();
      remove(tx.id);
      offerUndo({ label: dict.sms.deletedToast, restore: () => add(tx) });
    },
    [add, dict.sms.deletedToast, offerUndo, remove],
  );

  const onConfirmAll = useCallback(() => {
    const batch = [...transactions];
    hapticSuccess();
    batch.forEach(tx => confirm(tx.id));
    offerUndo({
      label: interpolate(dict.sms.allConfirmedToast, { n: toPersianDigits(batch.length) }),
      restore: restoreReview(batch),
    });
  }, [confirm, dict.sms.allConfirmedToast, offerUndo, restoreReview, transactions]);

  const seedForDev = useCallback(() => {
    const recent = [...snapshot.transactions]
      .filter(tx => tx.direction === 'out')
      .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))
      .slice(0, 2);
    recent.forEach((tx, i) =>
      update(tx.id, { needsReview: true, isConfirmed: false, confidence: i === 0 ? 0.74 : 0.66 }),
    );
    // No fake SMS here: ingesting one clears the guest-preview sample data by design.
  }, [snapshot.transactions, update]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const tx of transactions) {
      out.push({ kind: 'tx', id: tx.id, tx });
    }
    if (unknown.length) {
      out.push({ kind: 'header', id: 'h-unknown', title: dict.sms.unknownTitle });
      for (const item of unknown) {
        out.push({ kind: 'unknown', id: item.id, item });
      }
    }
    return out;
  }, [transactions, unknown, dict.sms.unknownTitle]);

  const money = useCallback(
    (rial: number) => (hidden ? '••••' : formatTomanFromRial(rial)),
    [hidden],
  );

  const renderItem = useCallback(
    ({ item }: { item: Row }) => {
      if (item.kind === 'header') {
        return (
          <AppText style={[styles.sectionTitle, { color: colors.textSecondary }]}>{item.title}</AppText>
        );
      }
      if (item.kind === 'unknown') {
        const u = item.item;
        return (
          <GlassPanel radius={24} style={styles.card}>
            <View style={styles.head}>
              <View style={[styles.tile, { backgroundColor: colors.glassStrong }]}>
                <MessageSquareWarning color={colors.text} size={20} strokeWidth={1.8} />
              </View>
              <View style={styles.headText}>
                <AppText style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                  {u.sender}
                </AppText>
                <AppText style={[styles.meta, { color: colors.textMuted }]}>
                  {reasonLabel(u.failureReason, dict)} · {jalaliDayLabel(jalaliDayKey(u.receivedAt))}
                </AppText>
              </View>
            </View>
            {__DEV__ && u.sanitizedMessage ? (
              <AppText style={[styles.meta, { color: colors.textMuted }]} numberOfLines={2}>
                {u.sanitizedMessage}
              </AppText>
            ) : null}
            <PressScale onPress={() => dismiss(u.id)} style={styles.alignStart}>
              <GlassPanel strong radius={14} style={styles.smallBtn}>
                <AppText style={[styles.smallBtnText, { color: colors.text }]}>{dict.sms.ignore}</AppText>
              </GlassPanel>
            </PressScale>
          </GlassPanel>
        );
      }

      const tx = item.tx;
      const income = tx.direction === 'in';
      const Icon = categoryIcons[tx.categoryId];
      const chips = income
        ? []
        : [tx.categoryId, ...QUICK_CATEGORIES.filter(c => c !== tx.categoryId)].slice(0, 3);
      const pct = Math.round((tx.confidence ?? 0) * 100);
      return (
        <GlassPanel radius={26} style={styles.card}>
          <View style={styles.head}>
            <View style={[styles.tile, { backgroundColor: colors.glassStrong }]}>
              <Icon color={colors.text} size={20} strokeWidth={1.9} />
            </View>
            <View style={styles.headText}>
              <AppText style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {tx.merchant ?? dict.categories[tx.categoryId]}
              </AppText>
              <AppText style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
                {accountName(tx.accountId)} · {toTimeLabel(tx.transactionDate)} ·{' '}
                {jalaliDayLabel(jalaliDayKey(tx.transactionDate))}
              </AppText>
            </View>
            <AppText style={[styles.amount, { color: income ? colors.income : colors.text }]}>
              {income ? '+' : '−'}
              {money(tx.amountRial)}
            </AppText>
          </View>

          {chips.length ? (
            <View style={styles.chips}>
              {chips.map((c, i) => {
                const suggested = i === 0;
                return (
                  <PressScale
                    key={c}
                    onPress={() => onConfirm(tx, c)}
                    accessibilityLabel={`${dict.categories[c]}${suggested ? `، ${dict.sms.suggested}` : ''}`}>
                    <GlassPanel
                      strong
                      radius={999}
                      style={[styles.chip, suggested && { borderColor: colors.text, borderWidth: 1.5 }]}>
                      <AppText style={[styles.chipText, { color: colors.text }]} numberOfLines={1}>
                        {dict.categories[c]}
                      </AppText>
                    </GlassPanel>
                  </PressScale>
                );
              })}
              <PressScale onPress={() => navigation.navigate('TransactionDetails', { id: tx.id })}>
                <GlassPanel strong radius={999} style={styles.chip}>
                  <AppText style={[styles.chipText, { color: colors.textSecondary }]}>
                    {dict.sms.moreCategories}
                  </AppText>
                </GlassPanel>
              </PressScale>
            </View>
          ) : null}

          <View style={styles.actions}>
            <PressScale
              style={styles.flex}
              onPress={() => onConfirm(tx)}
              accessibilityLabel={`${dict.sms.confirm}: ${tx.merchant ?? ''} ${dict.categories[tx.categoryId]}`}>
              <View style={[styles.confirmBtn, { backgroundColor: colors.primary }]}>
                <Check color={colors.onPrimary} size={18} strokeWidth={2.6} />
                <AppText style={[styles.confirmText, { color: colors.onPrimary }]} numberOfLines={1}>
                  {dict.sms.confirm} · {dict.categories[tx.categoryId]}
                </AppText>
              </View>
            </PressScale>
            <PressScale onPress={() => onDelete(tx)} accessibilityLabel={dict.transactions.delete}>
              <GlassPanel strong radius={16} style={styles.iconBtn}>
                <Trash2 color={colors.text} size={18} strokeWidth={1.8} />
              </GlassPanel>
            </PressScale>
          </View>
          {pct > 0 ? (
            <AppText style={[styles.confidence, { color: colors.textMuted }]}>
              {dict.sms.suggested} · {toPersianDigits(pct)}٪
            </AppText>
          ) : null}
        </GlassPanel>
      );
    },
    [accountName, colors, dict, dismiss, money, navigation, onConfirm, onDelete],
  );

  return (
    <NightCanvas>
      <View style={[styles.flex, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <PressScale onPress={() => navigation.goBack()} accessibilityLabel={dict.common.back}>
            <GlassPanel strong radius={16} style={styles.backBtn}>
              <ChevronRight color={colors.text} size={22} />
            </GlassPanel>
          </PressScale>
          <AppText style={[styles.screenTitle, { color: colors.text }]}>{dict.sms.reviewTitle}</AppText>
          <View style={[styles.brandTile, { backgroundColor: colors.primary }]}>
            <AppText style={[styles.brandGlyph, { color: colors.onPrimary }]}>پ</AppText>
          </View>
        </View>

        {transactions.length > 0 ? (
          <GlassPanel radius={24} style={styles.summary}>
            <View style={styles.summaryText}>
              <AppText style={[styles.title, { color: colors.text }]}>
                {interpolate(dict.sms.reviewCount, { n: toPersianDigits(transactions.length) })}
              </AppText>
              <AppText style={[styles.meta, { color: colors.textMuted }]}>{dict.sms.reviewHint}</AppText>
            </View>
            {transactions.length > 1 ? (
              <PressScale onPress={onConfirmAll}>
                <View style={[styles.allBtn, { backgroundColor: colors.primary }]}>
                  <AppText style={[styles.confirmText, { color: colors.onPrimary }]}>{dict.sms.confirmAll}</AppText>
                </View>
              </PressScale>
            ) : null}
          </GlassPanel>
        ) : null}

        {rows.length === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyState title={dict.sms.allDoneTitle} subtitle={dict.sms.allDoneBody} />
            {__DEV__ ? (
              <PressScale onPress={seedForDev} style={styles.alignCenter}>
                <GlassPanel strong radius={14} style={styles.smallBtn}>
                  <AppText style={[styles.smallBtnText, { color: colors.textSecondary }]}>{dict.sms.devSeed}</AppText>
                </GlassPanel>
              </PressScale>
            ) : null}
          </View>
        ) : (
          <View style={styles.flex}>
            <FlashList
              data={rows}
              keyExtractor={row => row.id}
              renderItem={renderItem}
              drawDistance={300}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 96 }}
              ItemSeparatorComponent={Gap}
            />
          </View>
        )}

        {undo ? (
          <View style={[styles.toastWrap, { bottom: insets.bottom + 16 }]} pointerEvents="box-none">
            <View style={[styles.toast, { backgroundColor: colors.primary }]} accessibilityLiveRegion="polite">
              <AppText style={[styles.toastText, { color: colors.onPrimary }]} numberOfLines={1}>
                {undo.label}
              </AppText>
              <PressScale
                onPress={() => {
                  undo.restore();
                  setUndo(null);
                }}
                hitSlop={10}>
                <AppText style={[styles.toastAction, { color: colors.highlight }]}>{dict.sms.undo}</AppText>
              </PressScale>
            </View>
          </View>
        ) : null}
      </View>
    </NightCanvas>
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

const rtl = { textAlign: 'right' as const, writingDirection: 'rtl' as const };

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { height: 10 },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  backBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  screenTitle: { fontSize: 17, fontFamily: theme.typography.fontFamily.semibold },
  brandTile: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  brandGlyph: { fontSize: 28, lineHeight: 40, fontFamily: theme.typography.fontFamily.bold },
  summary: { marginHorizontal: 16, marginBottom: 12, padding: 14, flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  summaryText: { flex: 1, alignItems: 'flex-end', gap: 2 },
  allBtn: { height: 44, paddingHorizontal: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { ...rtl, fontSize: 13, fontFamily: theme.typography.fontFamily.semibold, marginTop: 6 },
  card: { padding: 12, gap: 12 },
  head: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  tile: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  headText: { flex: 1, alignItems: 'flex-end', gap: 2, minWidth: 0 },
  title: { ...rtl, fontSize: 15, fontFamily: theme.typography.fontFamily.semibold },
  meta: { ...rtl, fontSize: 12, lineHeight: 18 },
  amount: { fontSize: 16, fontFamily: theme.typography.fontFamily.semibold },
  chips: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 },
  chip: { height: 40, paddingHorizontal: 14, justifyContent: 'center' },
  chipText: { fontSize: 13, fontFamily: theme.typography.fontFamily.semibold },
  actions: { flexDirection: 'row-reverse', gap: 8 },
  confirmBtn: {
    height: 48,
    borderRadius: 16,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  confirmText: { fontSize: 14, fontFamily: theme.typography.fontFamily.bold },
  iconBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  confidence: { ...rtl, fontSize: 11, marginTop: -4 },
  smallBtn: { height: 44, paddingHorizontal: 16, justifyContent: 'center' },
  smallBtnText: { fontSize: 13, fontFamily: theme.typography.fontFamily.semibold },
  alignStart: { alignSelf: 'flex-end' },
  alignCenter: { alignSelf: 'center', marginTop: 12 },
  emptyWrap: { flex: 1, paddingHorizontal: 16, paddingTop: 40 },
  toastWrap: { position: 'absolute', left: 16, right: 16 },
  toast: {
    minHeight: 52,
    borderRadius: 18,
    paddingHorizontal: 16,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toastText: { ...rtl, flex: 1, fontSize: 14, fontFamily: theme.typography.fontFamily.semibold },
  toastAction: { fontSize: 14, fontFamily: theme.typography.fontFamily.bold },
});
