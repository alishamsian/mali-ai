import React, { useMemo } from 'react';
import { View } from 'react-native';
import { ChevronLeft, CircleAlert } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../app/navigation/types';
import { navigateSmsHub } from '../../../app/navigation/smsNavigation';
import { AppText } from '../../../components/ui/AppText';
import { PressScale } from '../../../components/ui/PressScale';
import { useFinanceStore, selectReviewItems } from '../../../store/finance/store';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { budgetAlerts } from '../../../engine/budget/alerts';
import { findBalanceGaps } from '../../../engine/reconcile/balanceGaps';
import { DuesSummaryCard, useHomeDues } from '../../obligations/components/DuesSummaryCard';
import { formatTomanFromRial } from '../../../utils/currency/money';
import { jalaliDayKey, toJalaliLabel } from '../../../utils/dates/jalali';
import { toPersianDigits } from '../../../utils/numbers/digits';
import { interpolate, t } from '../../../i18n';

/** Preserve the existing home review/reconciliation/dues flows in one quiet notice. */
export function HomeFocus({ hidden }: { hidden: boolean }) {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const snapshot = useFinanceStore(s => s.snapshot);
  const dues = useHomeDues();
  const { colors } = useAppTheme();
  const dict = t();
  const styles = useThemedStyles((c, th) => ({
    row: {
      marginHorizontal: 16,
      padding: 13,
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.glassStrong,
      borderWidth: 1,
      borderColor: c.glassBorder,
      borderRadius: 17,
    },
    gutter: { marginHorizontal: 16 },
    text: { flex: 1, minWidth: 0, gap: 2 },
    title: {
      fontSize: 12,
      fontFamily: th.typography.fontFamily.semibold,
      color: c.text,
      textAlign: 'right',
    },
    sub: { fontSize: 10, lineHeight: 18, color: c.textMuted, textAlign: 'right' },
  }));
  const focus = useMemo(() => {
    const review = selectReviewItems(snapshot);
    const count = review.transactions.length + review.unknown.length;
    if (count) {
      return {
        title: interpolate(dict.dashboard.reviewTitle, { n: toPersianDigits(count) }),
        sub: dict.dashboard.reviewSub,
        go: () => nav.navigate('ReviewInbox'),
      };
    }
    const dismissed = new Set(snapshot.alertLog ?? []);
    const gap = findBalanceGaps(snapshot.transactions).find(
      g => !dismissed.has(`gap:${g.accountId}:${g.toDate}`),
    );
    if (gap) {
      return {
        title: interpolate(dict.dashboard.gapTitle, {
          bank: snapshot.accounts.find(a => a.id === gap.accountId)?.name ?? dict.banks.generic,
        }),
        sub: interpolate(gap.gapRial < 0 ? dict.dashboard.gapOut : dict.dashboard.gapIn, {
          amount: hidden ? '•••' : formatTomanFromRial(Math.abs(gap.gapRial)),
          from: toJalaliLabel(gap.fromDate),
          to: toJalaliLabel(gap.toDate),
        }),
        go: () => {
          useFinanceStore.getState().recordAlerts([`gap:${gap.accountId}:${gap.toDate}`]);
          nav.navigate('AddTransaction', {
            mode: gap.gapRial < 0 ? 'expense' : 'income',
            amountToman: Math.round(Math.abs(gap.gapRial) / 10),
            dayKey: jalaliDayKey(gap.toDate),
          });
        },
      };
    }
    const alert = budgetAlerts(snapshot)[0];
    if (alert && (alert.ratio >= 1 || !dues.length)) {
      return {
        title: dict.home.monthBudget,
        sub: hidden
          ? dict.home.amountHidden
          : interpolate(alert.ratio >= 1 ? dict.budgets.over : dict.budgets.warn, {
              name: dict.categories[alert.categoryId],
              pct: toPersianDigits(Math.round(alert.ratio * 100)),
            }),
        go: () => nav.navigate('Budgets'),
      };
    }
    if (dues.length) {
      return 'dues' as const;
    }
    if (snapshot.settings.guestPreviewActive) {
      return {
        title: dict.dashboard.guestPreviewHint,
        sub: '',
        go: () => navigateSmsHub(nav, false),
      };
    }
    return null;
  }, [snapshot, dues.length, hidden, nav, dict]);
  if (focus === 'dues') {
    return (
      <View style={styles.gutter}>
        <DuesSummaryCard hidden={hidden} />
      </View>
    );
  }
  if (!focus) {
    return null;
  }
  return (
    <PressScale onPress={focus.go} accessibilityRole="button" style={styles.row}>
      <CircleAlert size={18} color={colors.textSecondary} />
      <View style={styles.text}>
        <AppText style={styles.title}>{focus.title}</AppText>
        {focus.sub ? <AppText style={styles.sub}>{focus.sub}</AppText> : null}
      </View>
      <ChevronLeft size={16} color={colors.textMuted} />
    </PressScale>
  );
}
