import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  ArrowLeftRight,
  Bus,
  Clapperboard,
  GraduationCap,
  HeartPulse,
  Home,
  Percent,
  Receipt,
  Repeat,
  Shirt,
  ShoppingBag,
  Sparkles,
  Utensils,
  Wallet,
} from 'lucide-react-native';
import { useAppTheme } from '../../theme/ThemeBridge';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { AppText } from '../ui/AppText';
import { MoneyText } from '../ui/MoneyText';
import { PressScale } from '../ui/PressScale';
import { toTimeLabel } from '../../utils/dates/jalali';
import { formatTomanFromRial, getDisplayCurrencyPreference, displayUnitLabel } from '../../utils/currency/money';
import { t } from '../../i18n';
import { BankEmblem } from '../../components/banks/BankEmblem';
import { useFinanceStore } from '../../store/finance/store';
import {
  flowIconSurface,
  flowKindForTransaction,
  flowTint,
} from '../ui/FlowAmount';
import type { CategoryId, Transaction } from '../../types/finance';

const CAT_ICON: Record<CategoryId, React.ComponentType<{ color: string; size: number; strokeWidth?: number }>> = {
  housing: Home,
  food: Utensils,
  transport: Bus,
  shopping: ShoppingBag,
  bills: Receipt,
  health: HeartPulse,
  entertainment: Clapperboard,
  education: GraduationCap,
  travel: Sparkles,
  clothing: Shirt,
  subscriptions: Repeat,
  income: Wallet,
  transfer: ArrowLeftRight,
  fee: Percent,
  other: Wallet,
};

export const categoryIcons = CAT_ICON;

export function TransactionRow({
  tx,
  onPress,
  hidden,
  showDate = true,
  compact = false,
  grouped = false,
  isLast = false,
}: {
  tx: Transaction;
  onPress?: () => void;
  hidden?: boolean;
  /** نمایش زمان در ردیف — در گروه‌بندی روزانه خاموش می‌شود */
  showDate?: boolean;
  compact?: boolean;
  /** داخل کارت گروه‌بندی‌شده — بدون حاشیه بیرونی */
  grouped?: boolean;
  isLast?: boolean;
}) {
  const dict = t();
  const { colors, mode } = useAppTheme();
  const balancesHidden = useFinanceStore(s => s.snapshot.settings.hideBalances);
  const isHidden = hidden ?? balancesHidden;
  const account = useFinanceStore(s => s.snapshot.accounts.find(a => a.id === tx.accountId));
  const flow = flowKindForTransaction(tx);
  const tint = flowTint(flow, colors);
  const iconSurface = flowIconSurface(flow, mode);
  const moneyUnit =
    getDisplayCurrencyPreference() === 'IRR' ? dict.common.rial : displayUnitLabel();
  const styles = useThemedStyles((c, th) => ({
    row: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: compact ? 12 : 14,
      paddingVertical: compact ? 13 : 15,
      paddingHorizontal: grouped ? 4 : 4,
      borderBottomWidth: grouped && isLast ? 0 : StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    iconWrap: {
      width: compact ? 44 : 48,
      height: compact ? 44 : 48,
      borderRadius: compact ? 14 : 16,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    reviewDot: {
      position: 'absolute',
      top: -2,
      right: -2,
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: c.warning,
      borderWidth: 1.5,
      borderColor: c.surfaceSolid,
    },
    meta: { flex: 1, alignItems: 'flex-end', minWidth: 0, gap: 4 },
    title: {
      // Full width: a shrink-wrapped RTL title in a flex-end column was cut to «سا…».
      alignSelf: 'stretch',
      textAlign: 'right',
      writingDirection: 'rtl',
      fontFamily: th.typography.fontFamily.semibold,
      fontSize: compact ? 14 : 15,
      letterSpacing: -0.2,
    },
    subRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 6,
      maxWidth: '100%',
    },
    categoryPill: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(8,13,16,0.05)',
    },
    sub: { color: c.textMuted, textAlign: 'right', writingDirection: 'rtl' },
    dot: {
      width: 3,
      height: 3,
      borderRadius: 2,
      backgroundColor: c.textMuted,
      opacity: 0.5,
    },
    amountCol: {
      width: 96,
      flexShrink: 0,
      alignItems: 'flex-start',
      justifyContent: 'center',
      gap: 2,
    },
    amount: {
      width: '100%',
      fontSize: compact ? 13 : 15,
      letterSpacing: -0.3,
    },
    unit: {
      fontSize: 10,
      color: c.textMuted,
      writingDirection: 'rtl',
      textAlign: 'left',
      fontFamily: th.typography.fontFamily.medium,
    },
  }));
  const Icon = CAT_ICON[tx.categoryId];
  const bankId = account?.bankId;
  const showBank = tx.source === 'android_sms' && bankId && bankId !== 'cash';
  const sign = flow === 'income' ? '+' : flow === 'expense' ? '−' : '';
  const title = tx.merchant ?? dict.categories[tx.categoryId];
  const needsReview = tx.needsReview && !tx.isConfirmed;

  return (
    <PressScale onPress={onPress} accessibilityRole="button" style={styles.row}>
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: iconSurface.backgroundColor, borderColor: iconSurface.borderColor },
        ]}>
        {showBank ? (
          <BankEmblem bankId={bankId} size={compact ? 24 : 28} />
        ) : (
          <Icon color={tint} size={compact ? 18 : 20} strokeWidth={2} />
        )}
        {needsReview ? <View style={styles.reviewDot} /> : null}
      </View>

      <View style={styles.meta}>
        <AppText numberOfLines={1} style={[styles.title, { color: colors.text }]}>
          {title}
        </AppText>
        <View style={styles.subRow}>
          <View style={styles.categoryPill}>
            <AppText variant="caption" numberOfLines={1} style={{ color: tint, fontSize: 11 }}>
              {dict.categories[tx.categoryId]}
            </AppText>
          </View>
          {showDate ? (
            <>
              <View style={styles.dot} />
              <AppText variant="caption" numberOfLines={1} style={styles.sub}>
                {toTimeLabel(tx.transactionDate)}
              </AppText>
            </>
          ) : null}
        </View>
      </View>

      <View style={styles.amountCol}>
        <MoneyText
          align="left"
          minFontScale={0.55}
          style={[styles.amount, { color: tint }]}>
          {isHidden ? '••••' : `${sign}${formatTomanFromRial(tx.amountRial)}`}
        </MoneyText>
        {!isHidden ? (
          <AppText numberOfLines={1} style={styles.unit}>
            {moneyUnit}
          </AppText>
        ) : null}
      </View>
    </PressScale>
  );
}
