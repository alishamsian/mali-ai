import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown, ChevronRight, ChevronUp, HelpCircle, Trash2 } from 'lucide-react-native';
import { AppText } from '../../../components/ui/AppText';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { PressScale } from '../../../components/ui/PressScale';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { MoneyText } from '../../../components/ui/MoneyText';
import { BankEmblem } from '../../../components/banks/BankEmblem';
import { categoryIcons } from '../../../components/lists/TransactionRow';
import { CategoryPickerField } from '../components/CategoryPickerField';
import { DebtLinkCard } from '../components/DebtLinkCard';
import { EXPENSE_CATEGORIES } from '../../../constants/categories';
import { t, interpolate } from '../../../i18n';
import { appAlert } from '../../../components/ui/AppAlert';
import { toPersianDigits } from '../../../utils/numbers/digits';
import { toJalaliLabel, toTimeLabel } from '../../../utils/dates/jalali';
import {
  getDisplayCurrencyPreference,
  formatTomanFromRial,
  displayUnitLabel,
} from '../../../utils/currency/money';
import { useFinanceStore } from '../../../store/finance/store';
import {
  flowIconSurface,
  flowKindForTransaction,
  flowTint,
} from '../../../components/ui/FlowAmount';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { resolveBankName } from '../../banks/names';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../app/navigation/types';
import type { CategoryId, TransactionSource } from '../../../types/finance';

function sourceLabel(
  source: TransactionSource,
  dict: ReturnType<typeof t>['transactions'],
): string {
  switch (source) {
    case 'android_sms':
      return dict.autoSms;
    case 'manual':
      return dict.sourceManual;
    case 'open_banking':
      return dict.sourceOpenBanking;
    case 'csv':
      return dict.sourceCsv;
    case 'ios_message_filter':
      return dict.sourceIos;
    default:
      return dict.sourceManual;
  }
}

function flowLabel(
  flow: ReturnType<typeof flowKindForTransaction>,
  dict: ReturnType<typeof t>,
): string {
  if (flow === 'income') {
    return dict.flow.income;
  }
  if (flow === 'expense') {
    return dict.flow.expense;
  }
  return dict.flow.transfer;
}

function InfoRow({
  label,
  value,
  children,
  last,
  valueColor,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
  last?: boolean;
  valueColor?: string;
}) {
  const styles = useThemedStyles(c => ({
    row: {
      paddingVertical: 13,
      borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      gap: 6,
    },
    label: { textAlign: 'right', writingDirection: 'rtl' },
    value: { textAlign: 'right', writingDirection: 'rtl' },
  }));

  return (
    <View style={styles.row}>
      <AppText variant="caption" style={styles.label}>
        {label}
      </AppText>
      {children ?? (
        <AppText variant="label" style={[styles.value, valueColor ? { color: valueColor } : null]}>
          {value}
        </AppText>
      )}
    </View>
  );
}

export function TransactionDetailsScreen({
  route,
  navigation,
}: {
  route: RouteProp<RootStackParamList, 'TransactionDetails'>;
  navigation: NativeStackNavigationProp<RootStackParamList>;
}) {
  const insets = useSafeAreaInsets();
  const { colors, mode } = useAppTheme();
  const glass = mode === 'light';
  /** Danger red that keeps ≥5:1 on glass; the dark theme keeps its expense coral. */
  const danger = glass ? '#B23A3A' : colors.expense;
  const dict = t();
  const tx = useFinanceStore(s => s.snapshot.transactions.find(x => x.id === route.params.id));
  const hidden = useFinanceStore(s => s.snapshot.settings.hideBalances);
  const account = useFinanceStore(s => s.snapshot.accounts.find(a => a.id === tx?.accountId));
  const confirm = useFinanceStore(s => s.confirmTransaction);
  const recategorize = useFinanceStore(s => s.recategorizeTransaction);
  // After a manual category change, offer to fix the merchant's other transactions too.
  const offerMerchantRecategorize = (categoryId: CategoryId) => {
    const merchant = tx?.merchant?.trim();
    if (!merchant) {
      return;
    }
    const others = useFinanceStore
      .getState()
      .snapshot.transactions.filter(
        o =>
          o.id !== tx?.id &&
          o.merchant?.trim().toLowerCase() === merchant.toLowerCase() &&
          o.categoryId !== categoryId,
      ).length;
    if (others === 0) {
      return;
    }
    appAlert(
      interpolate(dict.transactions.learnTitle, { merchant }),
      interpolate(dict.transactions.learnBody, {
        n: others,
        category: dict.categories[categoryId],
      }),
      [
        {
          text: dict.transactions.learnAll,
          onPress: () => useFinanceStore.getState().recategorizeMerchant(merchant, categoryId),
        },
        { text: dict.transactions.learnOnlyThis, style: 'cancel' },
      ],
    );
  };
  const remove = useFinanceStore(s => s.deleteTransaction);
  const [whyOpen, setWhyOpen] = useState(false);
  // Two-step delete: the first tap arms it, a second tap within 4 s deletes.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) {
      return;
    }
    const id = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(id);
  }, [armed]);
  const styles = useThemedStyles((c, th) => ({
    screen: { flex: 1 },
    content: { paddingHorizontal: 16, paddingBottom: 40 },
    header: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    backBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 17, fontFamily: th.typography.fontFamily.semibold, color: c.text },
    brandTile: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
    },
    brandGlyph: {
      fontSize: 28,
      lineHeight: 40,
      fontFamily: th.typography.fontFamily.bold,
      color: c.onPrimary,
    },
    hero: {
      alignItems: 'center',
      paddingVertical: 22,
      paddingHorizontal: 18,
      marginBottom: 12,
      gap: 14,
    },
    heroTop: {
      width: '100%',
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 14,
    },
    iconWrap: {
      width: 54,
      height: 54,
      borderRadius: 17,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    heroMeta: { flex: 1, alignItems: 'flex-end', gap: 6, minWidth: 0 },
    merchant: {
      alignSelf: 'stretch',
      textAlign: 'right',
      writingDirection: 'rtl',
      fontFamily: th.typography.fontFamily.semibold,
      fontSize: 17,
      letterSpacing: -0.2,
    },
    flowPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
    },
    amountBlock: { alignItems: 'center', gap: 4, width: '100%', paddingHorizontal: 6 },
    amount: {
      width: '100%',
      fontSize: 40,
      letterSpacing: -1,
      fontFamily: th.typography.fontFamily.semibold,
    },
    unit: { fontSize: 12, color: c.textMuted },
    dateLine: { textAlign: 'center', color: c.textMuted },
    chips: {
      flexDirection: 'row-reverse',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 8,
    },
    chip: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: glass ? c.glassBorder : c.border,
      backgroundColor: glass ? c.glassStrong : 'rgba(255,255,255,0.04)',
    },
    reviewChip: {
      borderColor: c.highlight,
      backgroundColor: c.highlight,
    },
    section: { marginBottom: 12, paddingHorizontal: 14, paddingVertical: 4 },
    sectionTitle: {
      textAlign: 'right',
      marginTop: 4,
      marginBottom: 2,
      paddingHorizontal: 4,
    },
    categoryBlock: {
      paddingVertical: 10,
      paddingHorizontal: 2,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: glass ? c.glassBorder : c.border,
      backgroundColor: glass ? c.glassStrong : 'transparent',
      padding: 12,
      marginBottom: 4,
    },
    categoryBlockWarn: {
      borderColor: c.warning,
      backgroundColor: mode === 'dark' ? 'rgba(232,195,106,0.08)' : 'rgba(232,195,106,0.1)',
    },
    categoryHint: {
      textAlign: 'right',
      lineHeight: 20,
      marginBottom: 10,
    },
    whyToggle: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      gap: 10,
    },
    whyTitleRow: {
      flex: 1,
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 8,
    },
    whyBody: { gap: 10, paddingBottom: 12 },
    smsBox: {
      padding: 12,
      borderRadius: 16,
      backgroundColor: glass ? c.glassStrong : 'rgba(255,255,255,0.04)',
      borderWidth: 1,
      borderColor: c.border,
    },
    smsText: { lineHeight: 24, textAlign: 'right', writingDirection: 'rtl', fontSize: 13 },
    techBlock: {
      marginTop: 4,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      gap: 0,
    },
    actions: { gap: 10, marginTop: 8 },
    delete: {
      marginTop: 18,
      minHeight: 52,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: 'row-reverse',
      gap: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteText: { fontSize: 15, fontFamily: th.typography.fontFamily.semibold },
    mergedNote: {
      textAlign: 'right',
      marginTop: 8,
      paddingHorizontal: 4,
      lineHeight: 20,
    },
  }));

  const cats = useMemo((): CategoryId[] => {
    if (!tx) {
      return [];
    }
    return tx.direction === 'in' ? ['income', 'other'] : EXPENSE_CATEGORIES;
  }, [tx]);

  if (!tx) {
    return null;
  }

  const flow = flowKindForTransaction(tx);
  const tint = flowTint(flow, colors);
  const iconSurface = flowIconSurface(flow, mode);
  const Icon = categoryIcons[tx.categoryId];
  const isSms = tx.source === 'android_sms';
  const bankLabel = account?.bankId ? resolveBankName(account.bankId) : dict.banks.generic;
  const moneyUnit =
    getDisplayCurrencyPreference() === 'IRR' ? dict.common.rial : displayUnitLabel();
  const title = tx.merchant ?? dict.categories[tx.categoryId];
  const sign = flow === 'income' ? '+' : flow === 'expense' ? '−' : '';
  const parserLabel = tx.parserVersion ? `v${tx.parserVersion}` : dict.transactions.parserUnknown;
  const confidencePct = Math.round(tx.confidence * 100);
  const needsCategoryConfirm = tx.confidence < 1 || tx.needsReview;
  // Plain words instead of a percentage nobody can act on.
  const confidenceLabel =
    tx.source === 'manual'
      ? dict.transactions.confidenceManual
      : confidencePct >= 90
      ? dict.transactions.confidenceFull
      : confidencePct >= 60
      ? dict.transactions.confidenceLikely
      : dict.transactions.confidenceLow;

  return (
    <NightCanvas>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <PressScale onPress={() => navigation.goBack()} accessibilityLabel={dict.common.back}>
            <GlassPanel strong radius={16} style={styles.backBtn}>
              <ChevronRight color={colors.text} size={22} />
            </GlassPanel>
          </PressScale>
          <AppText style={styles.headerTitle}>{dict.transactions.details}</AppText>
          <View style={styles.brandTile}>
            <AppText style={styles.brandGlyph}>پ</AppText>
          </View>
        </View>

        <GlassPanel radius={30} style={styles.hero}>
          <View style={styles.heroTop}>
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: iconSurface.backgroundColor,
                  borderColor: iconSurface.borderColor,
                },
              ]}>
              {isSms && account?.bankId && account.bankId !== 'cash' ? (
                <BankEmblem bankId={account.bankId} size={28} />
              ) : (
                <Icon color={tint} size={22} strokeWidth={2} />
              )}
            </View>
            <View style={styles.heroMeta}>
              <AppText numberOfLines={2} style={[styles.merchant, { color: colors.text }]}>
                {title}
              </AppText>
              <View
                style={[
                  styles.flowPill,
                  { borderColor: `${tint}44`, backgroundColor: `${tint}14` },
                ]}>
                <AppText variant="caption" style={{ color: tint, fontSize: 11 }}>
                  {flowLabel(flow, dict)}
                </AppText>
              </View>
            </View>
          </View>

          <View style={styles.amountBlock}>
            <MoneyText align="center" minFontScale={0.48} style={[styles.amount, { color: tint }]}>
              {hidden ? '••••••' : `${sign}${formatTomanFromRial(tx.amountRial)}`}
            </MoneyText>
            {!hidden ? <AppText style={styles.unit}>{moneyUnit}</AppText> : null}
          </View>

          <AppText variant="caption" style={styles.dateLine}>
            {toJalaliLabel(tx.transactionDate)} · {toTimeLabel(tx.transactionDate)}
          </AppText>

          <View style={styles.chips}>
            <View style={styles.chip}>
              <AppText variant="caption">{account?.name ?? bankLabel}</AppText>
            </View>
            {tx.cardLast4 ? (
              <View style={styles.chip}>
                <AppText variant="caption">•••• {tx.cardLast4}</AppText>
              </View>
            ) : null}
            {needsCategoryConfirm ? (
              <View style={[styles.chip, styles.reviewChip]}>
                <AppText variant="caption" style={{ color: colors.onHighlight }}>
                  {dict.transactions.needsReview}
                </AppText>
              </View>
            ) : null}
          </View>
        </GlassPanel>

        <AppText variant="kicker" style={styles.sectionTitle}>
          {dict.transactions.info}
        </AppText>
        <GlassPanel radius={24} style={styles.section}>
          <View
            style={[styles.categoryBlock, needsCategoryConfirm ? styles.categoryBlockWarn : null]}>
            {needsCategoryConfirm ? (
              <AppText
                variant="caption"
                style={[styles.categoryHint, { color: colors.textSecondary }]}>
                {dict.transactions.pickCategoryHint}
              </AppText>
            ) : null}
            <CategoryPickerField
              label={dict.transactions.markCategory}
              categories={cats}
              selectedId={tx.categoryId}
              onSelect={id => {
                if (id !== 'all') {
                  recategorize(tx.id, id);
                  offerMerchantRecategorize(id);
                }
              }}
            />
          </View>
          <InfoRow
            label={dict.transactions.confidence}
            value={confidenceLabel}
            valueColor={confidencePct >= 100 ? colors.income : colors.warning}
          />
          <InfoRow label={dict.transactions.account} value={account?.name ?? '—'} />
          {tx.receiptCode ? (
            <InfoRow
              label={dict.transactions.receiptCode}
              value={toPersianDigits(tx.receiptCode)}
            />
          ) : null}
          <InfoRow
            label={dict.transactions.source}
            value={sourceLabel(tx.source, dict.transactions)}
            last
          />
        </GlassPanel>

        {tx.mergedFromId ? (
          <AppText variant="caption" style={[styles.mergedNote, { color: colors.textMuted }]}>
            {dict.transactions.mergedShort}
          </AppText>
        ) : null}

        {tx.notes ? (
          <>
            <AppText variant="kicker" style={styles.sectionTitle}>
              {dict.transactions.notes}
            </AppText>
            <GlassPanel radius={24} style={[styles.section, { paddingVertical: 14 }]}>
              <AppText style={{ textAlign: 'right', lineHeight: 24 }}>{tx.notes}</AppText>
            </GlassPanel>
          </>
        ) : null}

        {isSms ? (
          <GlassPanel radius={24} style={styles.section}>
            <PressScale onPress={() => setWhyOpen(v => !v)} style={styles.whyToggle}>
              <View style={styles.whyTitleRow}>
                <HelpCircle color={colors.textSecondary} size={18} />
                <AppText variant="label" style={{ flex: 1, textAlign: 'right' }}>
                  {dict.transactions.whyRecorded}
                </AppText>
              </View>
              {whyOpen ? (
                <ChevronUp color={colors.textMuted} size={18} />
              ) : (
                <ChevronDown color={colors.textMuted} size={18} />
              )}
            </PressScale>
            {whyOpen ? (
              <View style={styles.whyBody}>
                <AppText
                  variant="caption"
                  style={{ color: colors.textMuted, textAlign: 'right', lineHeight: 20 }}>
                  {dict.transactions.whyRecordedHint}
                </AppText>
                {tx.sourceSmsPreview ? (
                  <View style={styles.smsBox}>
                    <AppText style={styles.smsText}>{tx.sourceSmsPreview}</AppText>
                  </View>
                ) : (
                  <AppText
                    variant="caption"
                    style={{ color: colors.textMuted, textAlign: 'right', lineHeight: 20 }}>
                    {dict.transactions.smsPreviewMissing}
                  </AppText>
                )}
                <View style={styles.techBlock}>
                  <InfoRow label={dict.transactions.bank} value={bankLabel} />
                  <InfoRow label={dict.transactions.parser} value={parserLabel} last />
                </View>
              </View>
            ) : null}
          </GlassPanel>
        ) : null}

        <DebtLinkCard tx={tx} />

        <View style={styles.actions}>
          {needsCategoryConfirm ? (
            <PrimaryButton
              label={dict.transactions.confirmCategory}
              onPress={() => confirm(tx.id)}
            />
          ) : null}
          {isSms && needsCategoryConfirm ? (
            <AppText
              variant="caption"
              style={{ textAlign: 'right', lineHeight: 20, color: colors.textMuted }}>
              {dict.transactions.fixLearnHint}
            </AppText>
          ) : null}
        </View>

        <PressScale
          onPress={() => {
            if (!armed) {
              setArmed(true);
              return;
            }
            remove(tx.id);
            navigation.goBack();
          }}
          accessibilityRole="button"
          accessibilityLabel={armed ? dict.transactions.deleteConfirm : dict.transactions.delete}
          style={[
            styles.delete,
            armed
              ? { backgroundColor: danger, borderColor: danger }
              : {
                  backgroundColor: glass ? colors.glassStrong : 'transparent',
                  borderColor: glass ? colors.glassBorder : colors.border,
                },
          ]}>
          <Trash2 color={armed ? '#FFFFFF' : danger} size={18} strokeWidth={2} />
          <AppText style={[styles.deleteText, { color: armed ? '#FFFFFF' : danger }]}>
            {armed ? dict.transactions.deleteConfirm : dict.transactions.delete}
          </AppText>
        </PressScale>
      </ScrollView>
    </NightCanvas>
  );
}
