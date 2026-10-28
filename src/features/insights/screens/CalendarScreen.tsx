import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type RefreshControlProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { AppText } from '../../../components/ui/AppText';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { GlassCard } from '../../../components/ui/GlassCard';
import { PressScale } from '../../../components/ui/PressScale';
import { t } from '../../../i18n';
import { formatTomanLabel } from '../../../utils/currency/money';
import {
  addJalaliMonths,
  isoForJalaliDayKey,
  toJalaliLabel,
  toJalaliMonthYear,
  toJalaliYmd,
} from '../../../utils/dates/jalali';
import { toPersianDigits } from '../../../utils/numbers/digits';
import { useFinanceStore } from '../../../store/finance/store';
import { buildJalaliCashflow, buildJalaliCashflowForDayKey } from '../../../engine/insights/jalaliFlow';
import { isExpenseLike, isIncomeLike } from '../../../engine/insights/analytics';
import { TransactionRow } from '../../../components/lists/TransactionRow';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../app/navigation/types';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';

const WEEK = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

export function CalendarScreen({
  navigation: navigationProp,
  embedded = false,
  initialDayKey,
  refreshControl,
}: {
  navigation?: NativeStackNavigationProp<RootStackParamList>;
  embedded?: boolean;
  initialDayKey?: string;
  refreshControl?: React.ReactElement<RefreshControlProps>;
} = {}) {
  const insets = useSafeAreaInsets();
  // Always call the hook (rules of hooks); the prop wins when a parent passes one.
  const contextNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const navigation = navigationProp ?? contextNavigation;
  const { colors, mode } = useAppTheme();
  // Glass daylight heat is the highlight amber; mint belongs to the dark theme.
  const heatRgb = mode === 'light' ? '246,194,91' : '59,232,197';
  const snapshot = useFinanceStore(s => s.snapshot);
  const hidden = snapshot.settings.hideBalances;
  const dict = t();
  const [monthOffset, setMonthOffset] = useState(0);
  const anchorIso = useMemo(
    () => addJalaliMonths(new Date().toISOString(), monthOffset),
    [monthOffset],
  );
  const flow = useMemo(() => {
    if (initialDayKey && monthOffset === 0) {
      return buildJalaliCashflowForDayKey(snapshot.transactions, initialDayKey);
    }
    return buildJalaliCashflow(snapshot.transactions, new Date(anchorIso));
  }, [snapshot.transactions, initialDayKey, monthOffset, anchorIso]);
  const parsedDay = initialDayKey && monthOffset === 0 ? Number(initialDayKey.split('-')[2]) : flow.day;
  const [selected, setSelected] = useState(parsedDay);

  useEffect(() => {
    if (initialDayKey && monthOffset === 0) {
      setSelected(Number(initialDayKey.split('-')[2]));
    } else {
      setSelected(flow.day);
    }
  }, [initialDayKey, monthOffset, flow.day]);

  const styles = useThemedStyles((c, th) => ({
    monthNav: {
      flexDirection: 'row-reverse' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      marginBottom: 10,
      gap: 8,
    },
    monthBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: c.surfaceSolid,
    },
    monthTitle: { flex: 1, textAlign: 'center' as const },
    legend: { flexDirection: 'row-reverse' as const, alignItems: 'center' as const, gap: 8, justifyContent: 'center' as const },
    swatchOut: { width: 12, height: 12, borderRadius: 4, backgroundColor: th.mode === 'light' ? 'rgba(246,194,91,0.7)' : 'rgba(59,232,197,0.55)' },
    swatchIn: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.filament },
    week: { flexDirection: 'row-reverse' as const, marginBottom: 8 },
    grid: { flexDirection: 'row-reverse' as const, flexWrap: 'wrap' as const },
    cellLabel: { width: '14.28%' as const, textAlign: 'center' as const },
    cell: {
      width: '14.28%' as const,
      minHeight: 46,
      padding: 6,
      alignItems: 'flex-end' as const,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    today: { borderColor: c.primary, borderWidth: 1.5 },
    selected: { borderColor: c.filament, borderWidth: 1.5 },
    inDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: c.filament,
      marginTop: 8,
    },
    dayStats: { flexDirection: 'row-reverse' as const, justifyContent: 'space-between' as const, marginTop: 10 },
  }));

  const maxOut = Math.max(1, ...flow.days.map(d => d.expenseRial));
  const cells: Array<number | null> = [...Array(flow.lead).fill(null), ...flow.days.map(d => d.day)];
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  const slot = flow.days[selected - 1];
  const dayTx = snapshot.transactions.filter(tx => {
    const p = toJalaliYmd(tx.transactionDate);
    return p.year === flow.year && p.month === flow.month && p.day === selected;
  });
  const monthLabel = toJalaliMonthYear(isoForJalaliDayKey(`${flow.year}-${flow.month}-01`));
  const mask = (value: string) => (hidden ? '••••' : value);

  const body = (
    <ScrollView
      contentContainerStyle={{
        paddingTop: embedded ? 0 : insets.top + 16,
        padding: embedded ? 0 : 20,
        gap: 12,
        paddingBottom: embedded ? 8 : 40,
      }}
      nestedScrollEnabled={embedded}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}>
      {!embedded ? (
        <>
          <AppText variant="kicker" style={{ textAlign: 'center' }}>
            {monthLabel}
          </AppText>
          <AppText variant="title" style={{ textAlign: 'center' }}>
            {dict.insights.calendar}
          </AppText>
        </>
      ) : null}
      <View style={styles.legend}>
        <AppText variant="caption">{dict.insights.expenseHeat}</AppText>
        <View style={styles.swatchOut} />
        <AppText variant="caption">{dict.insights.incomeDot}</AppText>
        <View style={styles.swatchIn} />
      </View>
      <GlassCard>
        <View style={styles.monthNav}>
          <PressScale
            onPress={() => setMonthOffset(o => o + 1)}
            style={styles.monthBtn}
            accessibilityLabel={dict.insights.nextMonth}>
            <ChevronRight color={colors.textSecondary} size={20} />
          </PressScale>
          <AppText variant="title" style={styles.monthTitle}>
            {monthLabel}
          </AppText>
          <PressScale
            onPress={() => setMonthOffset(o => o - 1)}
            style={styles.monthBtn}
            accessibilityLabel={dict.insights.prevMonth}>
            <ChevronLeft color={colors.textSecondary} size={20} />
          </PressScale>
        </View>
        <View style={styles.week}>
          {WEEK.map(d => (
            <AppText key={d} variant="kicker" style={styles.cellLabel}>
              {d}
            </AppText>
          ))}
        </View>
        <View style={styles.grid}>
          {cells.map((day, i) => {
            const data = day ? flow.days[day - 1] : undefined;
            const heat = data && data.expenseRial ? 0.1 + (data.expenseRial / maxOut) * 0.55 : 0;
            const isToday = monthOffset === 0 && day === flow.day;
            const isSel = day === selected;
            return (
              <Pressable
                key={i}
                disabled={!day}
                onPress={() => day && setSelected(day)}
                style={[
                  styles.cell,
                  day ? { backgroundColor: `rgba(${heatRgb},${heat})` } : undefined,
                  isToday && styles.today,
                  isSel && styles.selected,
                ]}>
                {day ? (
                  <>
                    <AppText variant="caption">{toPersianDigits(day)}</AppText>
                    {data && data.incomeRial > 0 ? <View style={styles.inDot} /> : null}
                  </>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </GlassCard>
      <GlassCard>
        <AppText variant="kicker">{dict.insights.selectedDay}</AppText>
        <AppText style={{ marginTop: 6 }}>
          {(() => {
            const d = new Date(flow.startIso);
            d.setDate(d.getDate() + (selected - 1));
            return toJalaliLabel(d.toISOString());
          })()}
        </AppText>
        <View style={styles.dayStats}>
          <AppText variant="caption">
            {dict.dashboard.income} {mask(formatTomanLabel(slot?.incomeRial ?? 0))}
          </AppText>
          <AppText variant="caption">
            {dict.dashboard.expense} {mask(formatTomanLabel(slot?.expenseRial ?? 0))}
          </AppText>
        </View>
        {dayTx.length === 0 ? (
          <AppText variant="caption" style={{ marginTop: 10 }}>
            {dict.insights.noDayTx}
          </AppText>
        ) : (
          dayTx
            .filter(tx => isIncomeLike(tx) || isExpenseLike(tx) || tx.type === 'transfer')
            .map(tx => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                hidden={hidden}
                onPress={() => navigation.navigate('TransactionDetails', { id: tx.id })}
              />
            ))
        )}
      </GlassCard>
    </ScrollView>
  );

  if (embedded) {
    return body;
  }
  return <NightCanvas>{body}</NightCanvas>;
}
