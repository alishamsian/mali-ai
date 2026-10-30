import React from 'react';
import { View } from 'react-native';
import { Wallet } from 'lucide-react-native';
import { AppText } from '../../../components/ui/AppText';
import { MoneyText } from '../../../components/ui/MoneyText';
import { PressScale } from '../../../components/ui/PressScale';
import { categoryIcons } from '../../../components/lists/TransactionRow';
import { flowKindForTransaction } from '../../../components/ui/FlowAmount';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { formatTomanFromRial, displayUnitLabel } from '../../../utils/currency/money';
import { isSameDay, toJalaliLabel, toTimeLabel } from '../../../utils/dates/jalali';
import type { Transaction } from '../../../types/finance';
import { t } from '../../../i18n';
import { homePalette } from './homePalette';

export function RecentTransaction({
  tx,
  hidden,
  now,
  last,
  onPress,
}: {
  tx: Transaction;
  hidden: boolean;
  now: Date;
  last: boolean;
  onPress: () => void;
}) {
  const dict = t();
  const { colors, mode } = useAppTheme();
  const p = homePalette(mode);
  const flow = flowKindForTransaction(tx);
  const Icon = categoryIcons[tx.categoryId] ?? Wallet;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const date = isSameDay(tx.transactionDate, now.toISOString())
    ? `${dict.transactions.today}، ${toTimeLabel(tx.transactionDate)}`
    : isSameDay(tx.transactionDate, yesterday.toISOString())
    ? dict.transactions.yesterday
    : toJalaliLabel(tx.transactionDate);
  const title = tx.merchant || dict.categories[tx.categoryId] || dict.categories.other;
  const value = hidden
    ? '••••'
    : `${flow === 'income' ? '+' : flow === 'expense' ? '−' : ''}${formatTomanFromRial(
        tx.amountRial,
      )}`;
  const styles = useThemedStyles((c, th) => ({
    row: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 10,
      minHeight: 65,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderColor: p.divider,
    },
    last: { borderBottomWidth: 0 },
    glyph: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: p.quiet,
      borderWidth: 1,
      borderColor: p.divider,
      alignItems: 'center',
      justifyContent: 'center',
    },
    meta: { flex: 1, minWidth: 0, gap: 2 },
    title: {
      color: c.text,
      fontSize: 13,
      fontFamily: th.typography.fontFamily.semibold,
      alignSelf: 'stretch',
      textAlign: 'right',
    },
    date: { color: c.textMuted, fontSize: 10, alignSelf: 'stretch', textAlign: 'right' },
    value: { maxWidth: '39%', fontSize: 16, fontFamily: th.typography.fontFamily.bold },
    dot: {
      position: 'absolute',
      top: -2,
      right: -2,
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: c.warning,
    },
  }));
  return (
    <PressScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}، ${date}، ${
        hidden ? dict.home.amountHidden : `${value} ${displayUnitLabel()}`
      }${tx.needsReview ? `، ${dict.dashboard.reviewCta}` : ''}`}
      style={[styles.row, last && styles.last]}>
      <View style={styles.glyph}>
        <Icon size={18} strokeWidth={1.6} color={colors.textSecondary} />
        {tx.needsReview && !tx.isConfirmed ? <View style={styles.dot} /> : null}
      </View>
      <View style={styles.meta}>
        <AppText style={styles.title} numberOfLines={1}>
          {title}
        </AppText>
        <AppText style={styles.date} numberOfLines={1}>
          {date}
        </AppText>
      </View>
      <MoneyText
        style={[styles.value, { color: flow === 'income' ? colors.income : colors.text }]}
        align="left">
        {value}
      </MoneyText>
    </PressScale>
  );
}
