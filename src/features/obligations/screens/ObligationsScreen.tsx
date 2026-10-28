import { appAlert } from '../../../components/ui/AppAlert';
import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Check, Plus } from 'lucide-react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppText } from '../../../components/ui/AppText';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { PressScale } from '../../../components/ui/PressScale';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { t, interpolate } from '../../../i18n';
import { useFinanceStore } from '../../../store/finance/store';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { formatTomanFromRial } from '../../../utils/currency/money';
import { toPersianDigits } from '../../../utils/numbers/digits';
import { addJalaliMonths, startOfJalaliMonth, toJalaliLabel } from '../../../utils/dates/jalali';
import { monthEndForecast, upcomingDues, type DueItem } from '../../../engine/obligations/dues';
import { debtRemainingRial, planStatus } from '../../../engine/obligations/schedule';
import { chequeStatusLabel, daysLeftLabel } from '../format';
import type { RootStackParamList } from '../../../app/navigation/types';

type Tab = 'dues' | 'plans' | 'cheques' | 'debts';
const TABS: Tab[] = ['dues', 'plans', 'cheques', 'debts'];
const DUES_HORIZON_DAYS = 45;

function money(rial: number) {
  return `${formatTomanFromRial(rial)} ${t().common.toman}`;
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
  const store = useFinanceStore.getState;

  const now = useMemo(() => new Date(), []);
  const input = useMemo(() => ({ plans, cheques, debts }), [plans, cheques, debts]);
  const dues = useMemo(
    () => upcomingDues(input, now, DUES_HORIZON_DAYS, calendar),
    [input, now, calendar],
  );
  const forecast = useMemo(() => {
    const until = new Date(addJalaliMonths(startOfJalaliMonth(now.toISOString()).toISOString(), 1));
    return monthEndForecast({ ...input, accounts }, now, until, calendar);
  }, [input, accounts, now, calendar]);

  const styles = useThemedStyles((c, th) => ({
    body: { paddingHorizontal: th.spacing.lg, paddingBottom: 120 },
    summary: { padding: th.spacing.lg, gap: 12, marginBottom: th.spacing.md },
    kicker: { textAlign: 'right', color: c.textMuted, fontSize: 12 },
    projected: {
      textAlign: 'right',
      fontSize: 26,
      fontFamily: th.typography.fontFamily.bold,
      color: forecast.shortfall ? c.warning : c.text,
    },
    statsRow: { flexDirection: 'row-reverse', gap: 12 },
    stat: { flex: 1, gap: 2 },
    statValue: { textAlign: 'right', fontFamily: th.typography.fontFamily.semibold, color: c.text },
    warn: { textAlign: 'right', color: c.warning, fontSize: 12 },
    tabs: { marginBottom: th.spacing.md },
    list: { gap: 10 },
    row: { padding: 14, flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
    rowMain: { flex: 1, gap: 3 },
    rowTitle: { textAlign: 'right', fontFamily: th.typography.fontFamily.semibold, color: c.text },
    rowSub: { textAlign: 'right', color: c.textMuted, fontSize: 12 },
    amount: { fontFamily: th.typography.fontFamily.semibold, color: c.text },
    amountIn: { color: c.income },
    late: { color: c.warning },
    checkBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
    },
    addBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
    },
    track: { height: 6, borderRadius: 3, backgroundColor: c.glassBorder, overflow: 'hidden' },
    fill: { height: 6, borderRadius: 3, backgroundColor: c.highlight },
  }));

  const settleDue = (due: DueItem) => {
    if (due.kind === 'installment' && due.index != null) {
      store().markInstallmentPaid(due.refId, due.index);
    } else if (due.kind === 'cheque') {
      store().setChequeStatus(due.refId, 'cleared');
    } else {
      store().settleDebt(due.refId, due.amountRial);
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
      { text: dict.delete, style: 'destructive', onPress: () => confirmDelete(() => store().deleteCheque(id)) },
      { text: dict.cancel, style: 'cancel' },
    ]);

  const debtActions = (id: string, remaining: number) =>
    appAlert(dict.actions, undefined, [
      ...(remaining > 0 ? [{ text: dict.settle, onPress: () => store().settleDebt(id, remaining) }] : []),
      { text: dict.delete, style: 'destructive', onPress: () => confirmDelete(() => store().deleteDebt(id)) },
      { text: dict.cancel, style: 'cancel' },
    ]);

  const empty = (title: string) => (
    <EmptyState title={title} subtitle={dict.emptyHint} actionLabel={dict.add} onAction={() => nav.navigate('AddObligation')} />
  );

  const renderDues = () =>
    dues.length === 0
      ? empty(dict.emptyDues)
      : dues.map(due => (
          <GlassPanel key={due.key} radius={20} style={styles.row}>
            <View style={styles.rowMain}>
              <AppText style={styles.rowTitle} numberOfLines={1}>
                {due.title}
                {due.index != null ? ` · ${toPersianDigits(due.index + 1)}` : ''}
              </AppText>
              <AppText style={[styles.rowSub, due.overdue && styles.late]}>
                {[due.party, toJalaliLabel(due.dueDate), daysLeftLabel(due.daysLeft)].filter(Boolean).join(' · ')}
              </AppText>
            </View>
            <AppText style={[styles.amount, due.flow === 'in' && styles.amountIn]}>
              {due.flow === 'in' ? '+' : ''}
              {money(due.amountRial)}
            </AppText>
            <PressScale
              accessibilityRole="button"
              accessibilityLabel={due.flow === 'in' ? dict.markReceived : dict.markPaid}
              onPress={() => settleDue(due)}
              style={styles.checkBtn}>
              <Check size={18} color={colors.onPrimary} />
            </PressScale>
          </GlassPanel>
        ));

  const renderPlans = () =>
    plans.length === 0
      ? empty(dict.emptyList)
      : plans.map(plan => {
          const status = planStatus(plan, now, calendar);
          return (
            <PressScale key={plan.id} onLongPress={() => confirmDelete(() => store().deleteInstallmentPlan(plan.id))}>
              <GlassPanel radius={20} style={[styles.row, { flexDirection: 'column', alignItems: 'stretch' }]}>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
                  <AppText style={styles.rowTitle}>{plan.title}</AppText>
                  <AppText style={styles.amount}>{money(plan.installmentRial)}</AppText>
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${Math.round(status.progress * 100)}%` }]} />
                </View>
                <AppText style={[styles.rowSub, status.overdue.length > 0 && styles.late]}>
                  {[
                    interpolate(dict.paidOf, {
                      paid: toPersianDigits(status.paidCount),
                      total: toPersianDigits(plan.totalCount),
                    }),
                    status.done ? dict.done : `${dict.remaining} ${money(status.remainingRial)}`,
                    status.next ? `${dict.next}: ${toJalaliLabel(status.next.dueDate)}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </AppText>
              </GlassPanel>
            </PressScale>
          );
        });

  const renderCheques = () =>
    cheques.length === 0
      ? empty(dict.emptyList)
      : [...cheques]
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
          .map(cheque => (
            <PressScale key={cheque.id} onPress={() => chequeActions(cheque.id)}>
              <GlassPanel radius={20} style={styles.row}>
                <View style={styles.rowMain}>
                  <AppText style={styles.rowTitle}>
                    {cheque.counterparty} · {cheque.direction === 'issued' ? dict.issued : dict.received}
                  </AppText>
                  <AppText style={[styles.rowSub, cheque.status === 'bounced' && styles.late]}>
                    {toJalaliLabel(cheque.dueDate)} · {chequeStatusLabel(cheque.status)}
                  </AppText>
                </View>
                <AppText style={[styles.amount, cheque.direction === 'received' && styles.amountIn]}>
                  {money(cheque.amountRial)}
                </AppText>
              </GlassPanel>
            </PressScale>
          ));

  const renderDebts = () =>
    debts.length === 0
      ? empty(dict.emptyList)
      : debts.map(debt => {
          const remaining = debtRemainingRial(debt);
          return (
            <PressScale key={debt.id} onPress={() => debtActions(debt.id, remaining)}>
              <GlassPanel radius={20} style={styles.row}>
                <View style={styles.rowMain}>
                  <AppText style={styles.rowTitle}>
                    {debt.person} · {debt.direction === 'lent' ? dict.lent : dict.borrowed}
                  </AppText>
                  <AppText style={styles.rowSub}>
                    {remaining === 0
                      ? dict.done
                      : debt.dueDate
                        ? `${dict.dueDate}: ${toJalaliLabel(debt.dueDate)}`
                        : toJalaliLabel(debt.date)}
                  </AppText>
                </View>
                <AppText style={[styles.amount, debt.direction === 'lent' && styles.amountIn]}>
                  {money(remaining)}
                </AppText>
              </GlassPanel>
            </PressScale>
          );
        });

  const labelFor = (v: Tab) =>
    v === 'dues' ? dict.tabDues : v === 'plans' ? dict.tabPlans : v === 'cheques' ? dict.tabCheques : dict.tabDebts;

  return (
    <NightCanvas>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 8 }}>
        <View style={styles.body}>
          <ScreenHeader
            title={dict.title}
            subtitle={dict.subtitle}
            onBack={() => nav.goBack()}
            right={
              <PressScale accessibilityRole="button" accessibilityLabel={dict.add} onPress={() => nav.navigate('AddObligation')} style={styles.addBtn}>
                <Plus size={20} color={colors.onPrimary} />
              </PressScale>
            }
          />
          <GlassPanel strong style={styles.summary}>
            <AppText style={styles.kicker}>{`${dict.monthEnd} · ${dict.projected}`}</AppText>
            <AppText style={styles.projected}>{money(forecast.projectedRial)}</AppText>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <AppText style={styles.kicker}>{dict.outLabel}</AppText>
                <AppText style={styles.statValue}>{money(forecast.outRial)}</AppText>
              </View>
              <View style={styles.stat}>
                <AppText style={styles.kicker}>{dict.inLabel}</AppText>
                <AppText style={[styles.statValue, styles.amountIn]}>{money(forecast.inRial)}</AppText>
              </View>
            </View>
            {forecast.shortfall ? <AppText style={styles.warn}>{dict.shortfall}</AppText> : null}
          </GlassPanel>
          <View style={styles.tabs}>
            <SegmentedControl options={TABS} value={tab} onChange={setTab} labelFor={labelFor} />
          </View>
          <View style={styles.list}>
            {tab === 'dues' ? renderDues() : null}
            {tab === 'plans' ? renderPlans() : null}
            {tab === 'cheques' ? renderCheques() : null}
            {tab === 'debts' ? renderDebts() : null}
          </View>
        </View>
      </ScrollView>
    </NightCanvas>
  );
}
