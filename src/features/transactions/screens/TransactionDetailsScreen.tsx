import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react-native';
import { AppText } from '../../../components/ui/AppText';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { Surface } from '../../../components/ui/Surface';
import { PressScale } from '../../../components/ui/PressScale';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { AlertBanner } from '../../../components/ui/AlertBanner';
import { MoneyText } from '../../../components/ui/MoneyText';
import { BankEmblem } from '../../../components/banks/BankEmblem';
import { categoryIcons } from '../../../components/lists/TransactionRow';
import { CategoryPickerField } from '../components/CategoryPickerField';
import { EXPENSE_CATEGORIES } from '../../../constants/categories';
import { t, interpolate } from '../../../i18n';
import { toJalaliLabel, toTimeLabel } from '../../../utils/dates/jalali';
import { getDisplayCurrencyPreference, formatTomanFromRial } from '../../../utils/currency/money';
import { useFinanceStore } from '../../../store/finance/store';
import { flowIconSurface, flowKindForTransaction, flowTint } from '../../../components/ui/FlowAmount';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { resolveBankName } from '../../banks/names';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../app/navigation/types';
import type { CategoryId, TransactionSource } from '../../../types/finance';

function sourceLabel(source: TransactionSource, dict: ReturnType<typeof t>['transactions']): string {
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
  const { colors, mode, accent } = useAppTheme();
  const dict = t();
  const tx = useFinanceStore(s => s.snapshot.transactions.find(x => x.id === route.params.id));
  const hidden = useFinanceStore(s => s.snapshot.settings.hideBalances);
  const account = useFinanceStore(s => s.snapshot.accounts.find(a => a.id === tx?.accountId));
  const confirm = useFinanceStore(s => s.confirmTransaction);
  const recategorize = useFinanceStore(s => s.recategorizeTransaction);
  const remove = useFinanceStore(s => s.deleteTransaction);
  const [whyOpen, setWhyOpen] = useState(false);
  const styles = useThemedStyles((c, th) => ({
    screen: { flex: 1 },
    content: { paddingHorizontal: 20, paddingBottom: 40 },
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
    amount: { width: '100%', fontSize: 34, letterSpacing: -1 },
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
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(8,13,16,0.03)',
    },
    reviewChip: {
      borderColor: accent.primaryGlow,
      backgroundColor: accent.primaryGlow,
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
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
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
      borderRadius: 12,
      backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(8,13,16,0.04)',
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
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
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
    getDisplayCurrencyPreference() === 'IRR' ? dict.common.rial : dict.common.toman;
  const title = tx.merchant ?? dict.categories[tx.categoryId];
  const sign = flow === 'income' ? '+' : flow === 'expense' ? '−' : '';
  const parserLabel = tx.parserVersion ? `v${tx.parserVersion}` : dict.transactions.parserUnknown;
  const confidencePct = Math.round(tx.confidence * 100);
  const needsCategoryConfirm = tx.confidence < 1 || tx.needsReview;
  const confidenceLabel =
    confidencePct >= 100
      ? dict.transactions.confidenceFull
      : interpolate(dict.transactions.confidenceLow, { pct: confidencePct });

  return (
    <NightCanvas>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
        showsVerticalScrollIndicator={false}>
        <ScreenHeader title={dict.transactions.details} onBack={() => navigation.goBack()} />

        <Surface level="raised" style={styles.hero}>
          <View style={styles.heroTop}>
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: iconSurface.backgroundColor, borderColor: iconSurface.borderColor },
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
              <View style={[styles.flowPill, { borderColor: `${tint}44`, backgroundColor: `${tint}14` }]}>
                <AppText variant="caption" style={{ color: tint, fontSize: 11 }}>
                  {flowLabel(flow, dict)}
                </AppText>
              </View>
            </View>
          </View>

          <View style={styles.amountBlock}>
            <MoneyText
              align="center"
              minFontScale={0.48}
              style={[styles.amount, { color: tint }]}>
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
                <AppText variant="caption" style={{ color: colors.primary }}>
                  {dict.transactions.needsReview}
                </AppText>
              </View>
            ) : null}
          </View>
        </Surface>

        {needsCategoryConfirm ? (
          <AlertBanner tone="warn" message={dict.transactions.pickCategoryHint} />
        ) : null}

        <AppText variant="kicker" style={styles.sectionTitle}>
          {dict.transactions.info}
        </AppText>
        <Surface level="raised" style={styles.section}>
          <View
            style={[
              styles.categoryBlock,
              needsCategoryConfirm ? styles.categoryBlockWarn : null,
            ]}>
            {needsCategoryConfirm ? (
              <AppText variant="caption" style={[styles.categoryHint, { color: colors.textSecondary }]}>
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
          <InfoRow label={dict.transactions.source} value={sourceLabel(tx.source, dict.transactions)} last />
        </Surface>

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
            <Surface level="raised" style={[styles.section, { paddingVertical: 14 }]}>
              <AppText style={{ textAlign: 'right', lineHeight: 24 }}>{tx.notes}</AppText>
            </Surface>
          </>
        ) : null}

        {isSms ? (
          <Surface level="raised" style={styles.section}>
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
                <AppText variant="caption" style={{ color: colors.textMuted, textAlign: 'right', lineHeight: 20 }}>
                  {dict.transactions.whyRecordedHint}
                </AppText>
                {tx.sourceSmsPreview ? (
                  <View style={styles.smsBox}>
                    <AppText style={styles.smsText}>{tx.sourceSmsPreview}</AppText>
                  </View>
                ) : (
                  <AppText variant="caption" style={{ color: colors.textMuted, textAlign: 'right', lineHeight: 20 }}>
                    {dict.transactions.smsPreviewMissing}
                  </AppText>
                )}
                <View style={styles.techBlock}>
                  <InfoRow label={dict.transactions.bank} value={bankLabel} />
                  <InfoRow label={dict.transactions.parser} value={parserLabel} last />
                </View>
              </View>
            ) : null}
          </Surface>
        ) : null}

        <View style={styles.actions}>
          {needsCategoryConfirm ? (
            <PrimaryButton
              label={dict.transactions.confirmCategory}
              onPress={() => confirm(tx.id)}
            />
          ) : null}
          {isSms && needsCategoryConfirm ? (
            <AppText variant="caption" style={{ textAlign: 'right', lineHeight: 20, color: colors.textMuted }}>
              {dict.transactions.fixLearnHint}
            </AppText>
          ) : null}
        </View>

        <PressScale
          onPress={() => {
            remove(tx.id);
            navigation.goBack();
          }}
          style={styles.delete}>
          <AppText style={{ color: colors.expense }}>{dict.transactions.delete}</AppText>
        </PressScale>
      </ScrollView>
    </NightCanvas>
  );
}
