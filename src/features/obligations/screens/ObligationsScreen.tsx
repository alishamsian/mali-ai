import { appAlert } from '../../../components/ui/AppAlert';
import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowDownLeft, ArrowUpRight, Check, Plus } from 'lucide-react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppText } from '../../../components/ui/AppText';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { PressScale } from '../../../components/ui/PressScale';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { StatusChip } from '../../../components/ui/StatusChip';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { t, interpolate } from '../../../i18n';
import { useFinanceStore } from '../../../store/finance/store';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import {
  formatTomanFromRial,
  formatCompactToman,
  displayUnitLabel,
} from '../../../utils/currency/money';
import { toPersianDigits } from '../../../utils/numbers/digits';
import { toJalaliLabel, toJalaliMonthYear } from '../../../utils/dates/jalali';
import { currentMonthWindow } from '../../../engine/insights/monthPeriod';
import { monthEndForecast, upcomingDues, type DueItem } from '../../../engine/obligations/dues';
import { obligationsPosition } from '../../../engine/obligations/position';
import { suggestDueMatches } from '../../../engine/obligations/matching';
import { debtRemainingRial, planStatus } from '../../../engine/obligations/schedule';
import { chequeStatusLabel, daysLeftLabel } from '../format';
import type { RootStackParamList } from '../../../app/navigation/types';

/** Dismissed match suggestions live in the alert log under this prefix. */
const DISMISS = 'match-dismiss:';
type Tab = 'dues' | 'plans' | 'cheques' | 'debts' | 'balance';
const TABS: Tab[] = ['dues', 'plans', 'cheques', 'debts', 'balance'];
const DUES_HORIZON_DAYS = 45;

function money(rial: number) {
  return `${formatTomanFromRial(rial)} ${displayUnitLabel()}`;
}

type Bucket = 'overdue' | 'week' | 'month' | 'later';
const BUCKETS: Bucket[] = ['overdue', 'week', 'month', 'later'];

/** The day number and short month of a date, for the calendar badge on a due. */
function dayBadge(iso: string): { day: string; month: string } {
  const [day = '', month = ''] = toJalaliLabel(iso).split(' ');
  return { day, month };
}

export function ObligationsScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const dict = t().obligations;
  const { colors } = useAppTheme();
  const [tab, setTab] = useState<Tab>('dues');

  const plans = useFinanceStore(s => s.snapshot.installmentPlans);
  const cheques = useFinanceStore(s => s.snapshot.cheques);
  const debts = useFinanceStore(s => s.snapshot.debts);
  const accounts = useFinanceStore(s => s.snapshot.accounts);
  const calendar = useFinanceStore(s => s.snapshot.settings.calendar) ?? 'jalali';
  const startDay = useFinanceStore(s => s.snapshot.settings.financialMonthStartDay);

  const store = useFinanceStore.getState;
  const transactions = useFinanceStore(s => s.snapshot.transactions);
  const alertLog = useFinanceStore(s => s.snapshot.alertLog);

  const now = useMemo(() => new Date(), []);
  const input = useMemo(() => ({ plans, cheques, debts }), [plans, cheques, debts]);
  const dues = useMemo(
    () => upcomingDues(input, now, DUES_HORIZON_DAYS, calendar),
    [input, now, calendar],
  );
  // Bank SMS that look like a due being paid: one tap links and settles them.
  const matches = useMemo(
    () =>
      suggestDueMatches(
        { ...input, transactions },
        now,
        new Set(
          (alertLog ?? []).filter(k => k.startsWith(DISMISS)).map(k => k.slice(DISMISS.length)),
        ),
        calendar,
      ),
    [input, transactions, now, alertLog, calendar],
  );
  const forecast = useMemo(() => {
    const until = currentMonthWindow({ calendar, financialMonthStartDay: startDay }, now).end;
    return monthEndForecast({ ...input, accounts }, now, until, calendar);
  }, [input, accounts, now, calendar, startDay]);

  const grouped = useMemo(() => {
    const monthEnd = currentMonthWindow({ calendar, financialMonthStartDay: startDay }, now).end;
    const daysToMonthEnd = Math.ceil((monthEnd.getTime() - now.getTime()) / 86_400_000);
    const out: Record<Bucket, DueItem[]> = { overdue: [], week: [], month: [], later: [] };
    for (const due of dues) {
      const bucket: Bucket = due.overdue
        ? 'overdue'
        : due.daysLeft <= 7
        ? 'week'
        : due.daysLeft <= daysToMonthEnd
        ? 'month'
        : 'later';
      out[bucket].push(due);
    }
    return out;
  }, [dues, now, calendar, startDay]);
  const snapshotForMonths = useFinanceStore(s => s.snapshot);
  const position = useMemo(
    () => obligationsPosition(input, snapshotForMonths, now, 4, calendar),
    [input, snapshotForMonths, now, calendar],
  );

  const styles = useThemedStyles((c, th) => ({
    body: { paddingHorizontal: th.spacing.lg, paddingBottom: 120 },
    hero: { padding: 18, gap: 12, marginBottom: 14 },
    kicker: { textAlign: 'right', color: c.textSecondary, fontSize: 12.5 },
    projected: {
      textAlign: 'right',
      fontSize: 28,
      lineHeight: 42,
      fontFamily: th.typography.fontFamily.bold,
      color: forecast.shortfall ? c.warning : c.text,
    },
    flow: { flexDirection: 'row-reverse', gap: 18 },
    flowItem: { flex: 1, gap: 2 },
    flowDot: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    flowValue: { textAlign: 'right', fontFamily: th.typography.fontFamily.semibold, color: c.text },
    warn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
    tabs: { marginBottom: 14 },
    list: { gap: 8 },
    group: { gap: 8, marginBottom: 6 },
    groupHead: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
      marginTop: 6,
    },
    groupTitle: { color: c.text, fontSize: 14, fontFamily: th.typography.fontFamily.semibold },
    groupSum: { color: c.textMuted, fontSize: 12 },
    row: { padding: 12, flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
    rowMain: { flex: 1, gap: 3 },
    rowTitle: { textAlign: 'right', fontFamily: th.typography.fontFamily.semibold, color: c.text },
    rowSub: { textAlign: 'right', color: c.textMuted, fontSize: 12 },
    badge: {
      width: 46,
      height: 50,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.glassStrong,
      borderWidth: 1,
      borderColor: c.glassBorder,
    },
    badgeDay: {
      fontSize: 17,
      lineHeight: 22,
      fontFamily: th.typography.fontFamily.bold,
      color: c.text,
    },
    badgeMonth: { fontSize: 10.5, color: c.textMuted },
    side: { alignItems: 'flex-start', gap: 4 },
    amount: { fontFamily: th.typography.fontFamily.semibold, color: c.text },
    amountIn: { color: c.income },
    late: { color: c.warning },
    matchBtn: {
      flex: 1,
      borderRadius: 14,
      minHeight: 42,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: c.glassBorder,
    },
    addBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
    },
    card: { padding: 14, gap: 10 },
    cardHead: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
    icon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    meta: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  }));

  const settleDue = (due: DueItem, transactionId?: string) => {
    if (due.kind === 'installment' && due.index != null) {
      store().markInstallmentPaid(due.refId, due.index, transactionId);
    } else if (due.kind === 'cheque') {
      store().setChequeStatus(due.refId, 'cleared', transactionId);
    } else {
      store().settleDebt(due.refId, due.amountRial, transactionId);
    }
  };

  const confirmDelete = (onDelete: () => void) =>
    appAlert(dict.deleteConfirm, undefined, [
      { text: dict.cancel, style: 'cancel' },
      { text: dict.delete, style: 'destructive', onPress: onDelete },
    ]);

  const chequeActions = (id: string) =>
    appAlert(dict.actions, undefined, [
      { text: dict.statusCleared, onPress: () => store().setChequeStatus(id, 'cleared') },
      { text: dict.bounce, onPress: () => store().setChequeStatus(id, 'bounced') },
      {
        text: dict.delete,
        style: 'destructive',
        onPress: () => confirmDelete(() => store().deleteCheque(id)),
      },
      { text: dict.cancel, style: 'cancel' },
    ]);

  const debtActions = (id: string, remaining: number) =>
    appAlert(dict.actions, undefined, [
      ...(remaining > 0
        ? [{ text: dict.settle, onPress: () => store().settleDebt(id, remaining) }]
        : []),
      {
        text: dict.delete,
        style: 'destructive',
        onPress: () => confirmDelete(() => store().deleteDebt(id)),
      },
      { text: dict.cancel, style: 'cancel' },
    ]);

  const empty = (title: string) => (
    <EmptyState
      title={title}
      subtitle={dict.emptyHint}
      actionLabel={dict.add}
      onAction={() => nav.navigate('AddObligation')}
    />
  );

  const urgency = (due: DueItem) =>
    due.overdue
      ? colors.expense
      : due.daysLeft <= 3
      ? colors.warning
      : due.flow === 'in'
      ? colors.income
      : colors.textSecondary;

  const renderDueRow = (due: DueItem) => {
    const badge = dayBadge(due.dueDate);
    const tone = urgency(due);
    return (
      <GlassPanel key={due.key} radius={20} style={styles.row}>
        <View style={styles.badge}>
          <AppText style={styles.badgeDay}>{badge.day}</AppText>
          <AppText style={styles.badgeMonth}>{badge.month}</AppText>
        </View>
        <View style={styles.rowMain}>
          <AppText style={styles.rowTitle} numberOfLines={1}>
            {due.title}
            {due.index != null ? ` · ${toPersianDigits(due.index + 1)}` : ''}
          </AppText>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
            <StatusChip label={daysLeftLabel(due.daysLeft)} color={tone} />
            {due.party ? (
              <AppText style={styles.rowSub} numberOfLines={1}>
                {due.party}
              </AppText>
            ) : null}
          </View>
        </View>
        <View style={styles.side}>
          <AppText style={[styles.amount, due.flow === 'in' && styles.amountIn]}>
            {due.flow === 'in' ? '+' : ''}
            {money(due.amountRial)}
          </AppText>
        </View>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={due.flow === 'in' ? dict.markReceived : dict.markPaid}
          onPress={() => settleDue(due)}
          style={styles.checkBtn}>
          <Check size={18} color={colors.textSecondary} />
        </PressScale>
      </GlassPanel>
    );
  };

  const renderDues = () =>
    dues.length === 0
      ? empty(dict.emptyDues)
      : BUCKETS.filter(b => grouped[b].length > 0).map(bucket => {
          const total = grouped[bucket].reduce(
            (sum, due) => sum + (due.flow === 'out' ? due.amountRial : 0),
            0,
          );
          return (
            <View key={bucket} style={styles.group}>
              <View style={styles.groupHead}>
                <AppText style={[styles.groupTitle, bucket === 'overdue' && styles.late]}>
                  {dict.groups[bucket]}
                </AppText>
                {total > 0 ? (
                  <AppText style={styles.groupSum}>{formatCompactToman(total)}</AppText>
                ) : null}
              </View>
              {grouped[bucket].map(renderDueRow)}
            </View>
          );
        });

  const renderPlans = () =>
    plans.length === 0
      ? empty(dict.emptyList)
      : plans.map(plan => {
          const status = planStatus(plan, now, calendar);
          const tone =
            status.overdue.length > 0
              ? colors.expense
              : status.done
              ? colors.income
              : colors.highlight;
          return (
            <PressScale
              key={plan.id}
              onLongPress={() => confirmDelete(() => store().deleteInstallmentPlan(plan.id))}>
              <GlassPanel radius={20} style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={styles.rowMain}>
                    <AppText style={styles.rowTitle} numberOfLines={1}>
                      {plan.title}
                    </AppText>
                    <AppText style={styles.rowSub}>
                      {status.done
                        ? dict.done
                        : status.next
                        ? `${dict.next}: ${toJalaliLabel(status.next.dueDate)}`
                        : ''}
                    </AppText>
                  </View>
                  <View style={styles.side}>
                    <AppText style={styles.amount}>{money(plan.installmentRial)}</AppText>
                    {status.overdue.length > 0 ? (
                      <StatusChip
                        label={interpolate(dict.overdueCount, {
                          n: toPersianDigits(status.overdue.length),
                        })}
                        color={colors.expense}
                      />
                    ) : null}
                  </View>
                </View>
                {plan.openEnded ? null : (
                  <ProgressBar progress={status.progress} color={tone} track={colors.glassBorder} />
                )}
                <View style={styles.meta}>
                  <AppText style={styles.rowSub}>
                    {plan.openEnded
                      ? interpolate(dict.paidMonths, { n: toPersianDigits(status.paidCount) })
                      : interpolate(dict.paidOf, {
                          paid: toPersianDigits(status.paidCount),
                          total: toPersianDigits(plan.totalCount),
                        })}
                  </AppText>
                  {plan.openEnded ? (
                    <StatusChip label={dict.repeatMonthly} color={colors.textSecondary} />
                  ) : !status.done ? (
                    <AppText style={styles.rowSub}>
                      {`${dict.remaining} ${money(status.remainingRial)}`}
                    </AppText>
                  ) : null}
                </View>
              </GlassPanel>
            </PressScale>
          );
        });

  const chequeTone = (status: string) =>
    status === 'bounced'
      ? colors.expense
      : status === 'cleared'
      ? colors.income
      : status === 'cancelled'
      ? colors.textMuted
      : colors.warning;

  const renderCheques = () =>
    cheques.length === 0
      ? empty(dict.emptyList)
      : [...cheques]
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
          .map(cheque => {
            const incoming = cheque.direction === 'received';
            const Arrow = incoming ? ArrowDownLeft : ArrowUpRight;
            const tint = incoming ? colors.income : colors.textSecondary;
            return (
              <PressScale key={cheque.id} onPress={() => chequeActions(cheque.id)}>
                <GlassPanel radius={20} style={styles.row}>
                  <View style={[styles.icon, { backgroundColor: colors.glassStrong }]}>
                    <Arrow size={20} color={tint} />
                  </View>
                  <View style={styles.rowMain}>
                    <AppText style={styles.rowTitle} numberOfLines={1}>
                      {cheque.counterparty}
                    </AppText>
                    <AppText style={styles.rowSub}>
                      {`${
                        cheque.direction === 'issued' ? dict.issued : dict.received
                      } · ${toJalaliLabel(cheque.dueDate)}`}
                    </AppText>
                  </View>
                  <View style={styles.side}>
                    <AppText style={[styles.amount, incoming && styles.amountIn]}>
                      {money(cheque.amountRial)}
                    </AppText>
                    <StatusChip
                      label={chequeStatusLabel(cheque.status)}
                      color={chequeTone(cheque.status)}
                    />
                  </View>
                </GlassPanel>
              </PressScale>
            );
          });

  const renderDebts = () =>
    debts.length === 0
      ? empty(dict.emptyList)
      : debts.map(debt => {
          const remaining = debtRemainingRial(debt);
          const lent = debt.direction === 'lent';
          return (
            <PressScale key={debt.id} onPress={() => debtActions(debt.id, remaining)}>
              <GlassPanel radius={20} style={styles.row}>
                <View style={[styles.icon, { backgroundColor: colors.glassStrong }]}>
                  <AppText style={styles.badgeDay}>{debt.person.trim().charAt(0) || '؟'}</AppText>
                </View>
                <View style={styles.rowMain}>
                  <AppText style={styles.rowTitle} numberOfLines={1}>
                    {debt.person}
                  </AppText>
                  <AppText style={styles.rowSub}>
                    {remaining === 0
                      ? dict.done
                      : debt.dueDate
                      ? `${dict.dueDate}: ${toJalaliLabel(debt.dueDate)}`
                      : toJalaliLabel(debt.date)}
                  </AppText>
                </View>
                <View style={styles.side}>
                  <AppText style={[styles.amount, lent && styles.amountIn]}>
                    {money(remaining)}
                  </AppText>
                  <StatusChip
                    label={lent ? dict.lent : dict.borrowed}
                    color={lent ? colors.income : colors.warning}
                  />
                </View>
              </GlassPanel>
            </PressScale>
          );
        });

  const renderBalance = () => {
    const net = position.totalReceiveRial - position.totalPayRial;
    const parts: [string, number][] = [
      [dict.partInstallments, position.split.installments],
      [dict.partCheques, position.split.cheques],
      [dict.partDebts, position.split.debts],
    ];
    return (
      <>
        <GlassPanel strong radius={22} style={styles.card}>
          <AppText style={styles.rowSub}>{dict.netTotal}</AppText>
          <AppText style={[styles.projected, { color: net < 0 ? colors.expense : colors.income }]}>
            {`${net > 0 ? '+' : ''}${money(net)}`}
          </AppText>
          <View style={styles.flow}>
            <View style={styles.flowItem}>
              <AppText style={styles.kicker}>{dict.youOwe}</AppText>
              <AppText style={styles.flowValue}>{money(position.totalPayRial)}</AppText>
            </View>
            <View style={styles.flowItem}>
              <AppText style={styles.kicker}>{dict.owedToYou}</AppText>
              <AppText style={[styles.flowValue, styles.amountIn]}>
                {money(position.totalReceiveRial)}
              </AppText>
            </View>
          </View>
          {position.totalPayRial > 0 ? (
            <View style={{ gap: 6 }}>
              {parts
                .filter(([, v]) => v > 0)
                .map(([name, v]) => (
                  <View key={name} style={{ gap: 4 }}>
                    <View style={styles.meta}>
                      <AppText style={styles.rowSub}>{name}</AppText>
                      <AppText style={styles.rowSub}>{formatCompactToman(v)}</AppText>
                    </View>
                    <ProgressBar
                      progress={v / position.totalPayRial}
                      color={colors.expense}
                      track={colors.glassBorder}
                      height={6}
                    />
                  </View>
                ))}
            </View>
          ) : null}
        </GlassPanel>
        <AppText style={[styles.groupTitle, { marginTop: 6 }]}>{dict.byMonth}</AppText>
        {position.months.map((m, i) => {
          const monthNet = m.receiveRial - m.payRial;
          return (
            <GlassPanel key={i} radius={20} style={styles.card}>
              <View style={styles.meta}>
                <AppText style={styles.rowTitle}>
                  {toJalaliMonthYear(new Date(m.start.getTime() + 86_400_000).toISOString())}
                </AppText>
                <AppText
                  style={[styles.amount, { color: monthNet < 0 ? colors.expense : colors.income }]}>
                  {`${monthNet > 0 ? '+' : ''}${money(monthNet)}`}
                </AppText>
              </View>
              <View style={styles.flow}>
                <View style={styles.flowItem}>
                  <AppText style={styles.kicker}>{dict.youOwe}</AppText>
                  <AppText style={styles.amount}>{money(m.payRial)}</AppText>
                </View>
                <View style={styles.flowItem}>
                  <AppText style={styles.kicker}>{dict.owedToYou}</AppText>
                  <AppText style={[styles.amount, styles.amountIn]}>{money(m.receiveRial)}</AppText>
                </View>
              </View>
              {i === 0 && m.overdueRial > 0 ? (
                <StatusChip
                  label={interpolate(dict.includesOverdue, {
                    amount: formatCompactToman(m.overdueRial),
                  })}
                  color={colors.expense}
                />
              ) : null}
            </GlassPanel>
          );
        })}
      </>
    );
  };

  const labelFor = (v: Tab) => {
    const name =
      v === 'dues'
        ? dict.tabDues
        : v === 'plans'
        ? dict.tabPlans
        : v === 'cheques'
        ? dict.tabCheques
        : v === 'debts'
        ? dict.tabDebtsShort
        : dict.tabBalance;
    return name;
  };

  return (
    <NightCanvas>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 8 }}>
        <View style={styles.body}>
          <ScreenHeader
            title={dict.title}
            subtitle={dict.subtitle}
            onBack={() => nav.goBack()}
            right={
              <PressScale
                accessibilityRole="button"
                accessibilityLabel={dict.add}
                onPress={() => nav.navigate('AddObligation')}
                style={styles.addBtn}>
                <Plus size={20} color={colors.onPrimary} />
              </PressScale>
            }
          />
          <GlassPanel strong radius={24} style={styles.hero}>
            <AppText style={styles.kicker}>{`${dict.monthEnd} · ${dict.projected}`}</AppText>
            <AppText style={styles.projected}>{money(forecast.projectedRial)}</AppText>
            {forecast.outRial + forecast.inRial > 0 ? (
              <ProgressBar
                progress={forecast.outRial / (forecast.outRial + forecast.inRial)}
                color={colors.expense}
                track={colors.income}
                height={6}
              />
            ) : null}
            <View style={styles.flow}>
              <View style={styles.flowItem}>
                <View style={styles.flowDot}>
                  <View style={[styles.dot, { backgroundColor: colors.expense }]} />
                  <AppText style={styles.kicker}>{dict.outLabel}</AppText>
                </View>
                <AppText style={styles.flowValue}>{money(forecast.outRial)}</AppText>
              </View>
              <View style={styles.flowItem}>
                <View style={styles.flowDot}>
                  <View style={[styles.dot, { backgroundColor: colors.income }]} />
                  <AppText style={styles.kicker}>{dict.inLabel}</AppText>
                </View>
                <AppText style={[styles.flowValue, styles.amountIn]}>
                  {money(forecast.inRial)}
                </AppText>
              </View>
            </View>
            {forecast.shortfall ? (
              <View style={styles.warn}>
                <StatusChip label={dict.shortfall} color={colors.warning} />
              </View>
            ) : null}
          </GlassPanel>
          <View style={styles.tabs}>
            <SegmentedControl options={TABS} value={tab} onChange={setTab} labelFor={labelFor} />
          </View>
          <View style={styles.list}>
            {tab === 'dues'
              ? matches.map(m => (
                  <GlassPanel
                    key={m.key}
                    strong
                    radius={20}
                    style={[
                      styles.row,
                      { flexDirection: 'column', alignItems: 'stretch', gap: 6 },
                    ]}>
                    <AppText style={styles.rowTitle}>{dict.matchTitle}</AppText>
                    <AppText style={styles.rowSub}>
                      {interpolate(dict.matchBody, {
                        amount: formatTomanFromRial(m.transaction.amountRial),
                        date: toJalaliLabel(m.transaction.transactionDate),
                        title: m.due.title,
                      })}
                    </AppText>
                    <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 4 }}>
                      <PressScale
                        onPress={() => settleDue(m.due, m.transaction.id)}
                        style={[styles.matchBtn, { backgroundColor: colors.primary }]}>
                        <AppText style={{ color: colors.onPrimary }}>{dict.matchYes}</AppText>
                      </PressScale>
                      <PressScale
                        onPress={() => store().recordAlerts([`${DISMISS}${m.key}`])}
                        style={styles.matchBtn}>
                        <AppText style={{ color: colors.textMuted }}>{dict.matchNo}</AppText>
                      </PressScale>
                    </View>
                  </GlassPanel>
                ))
              : null}
            {tab === 'dues' ? renderDues() : null}
            {tab === 'plans' ? renderPlans() : null}
            {tab === 'cheques' ? renderCheques() : null}
            {tab === 'debts' ? renderDebts() : null}
            {tab === 'balance' ? renderBalance() : null}
          </View>
        </View>
      </ScrollView>
    </NightCanvas>
  );
}
