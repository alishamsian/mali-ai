import { NativeModules, Platform } from 'react-native';
import type { FinanceSnapshot } from '../../database/schema/snapshot';
import { monthlyTotals } from '../../engine/insights/analytics';
import { currentMonthWindow } from '../../engine/insights/monthPeriod';
import { currentMonthlyLimitRial, safeToSpendToday } from '../../engine/insights/safeToSpend';
import { t, interpolate } from '../../i18n';
import { useFinanceStore } from '../../store/finance/store';
import {
  displayUnitLabel,
  formatCompactToman,
  formatTomanFromRial,
} from '../../utils/currency/money';
import { jalaliDayKey } from '../../utils/dates/jalali';

/** Everything the home-screen widget shows, already formatted. */
export type WidgetState = {
  kicker: string;
  amount: string;
  sub: string;
  /** 0–100, or -1 to hide the bar. */
  progress: number;
  todayLabel: string;
  today: string;
  monthLabel: string;
  month: string;
};

const MASK = '••••';

export function buildWidgetState(
  snapshot: Pick<FinanceSnapshot, 'transactions' | 'budgets' | 'settings'>,
  now = new Date(),
): WidgetState {
  const dict = t().widget;
  const hidden = snapshot.settings.hideBalances;
  const window = currentMonthWindow(snapshot.settings, now);
  const start = window.start.getTime();
  const todayKey = jalaliDayKey(now);
  const monthTx = snapshot.transactions.filter(tx => {
    const at = Date.parse(tx.transactionDate);
    return at >= start && at <= now.getTime();
  });
  const month = monthlyTotals(monthTx);
  const today = monthlyTotals(
    monthTx.filter(tx => jalaliDayKey(tx.transactionDate) === todayKey),
  ).expenseRial;
  const limit = currentMonthlyLimitRial(snapshot);
  const safe = safeToSpendToday({
    monthlyLimitRial: limit,
    monthIncomeRial: month.incomeRial,
    monthExpenseRial: month.expenseRial,
    todayExpenseRial: today,
    dayOfMonth: window.day,
    daysInMonth: window.daysInMonth,
  });
  const unit = displayUnitLabel();
  const money = (rial: number) => (hidden ? MASK : `${formatTomanFromRial(rial)} ${unit}`);
  const short = (rial: number) => (hidden ? MASK : formatCompactToman(rial));
  const pool = limit && limit > 0 ? limit : month.incomeRial;
  const progress = pool > 0 ? Math.round(Math.min(1, month.expenseRial / pool) * 100) : -1;

  if (safe.basis === 'none') {
    return {
      kicker: dict.spentToday,
      amount: money(today),
      sub: dict.noPool,
      progress: -1,
      todayLabel: dict.monthSpent,
      today: short(month.expenseRial),
      monthLabel: dict.monthIncome,
      month: short(month.incomeRial),
    };
  }
  return {
    kicker: safe.leftRial > 0 ? dict.canSpend : dict.overToday,
    amount: money(Math.max(0, safe.leftRial)),
    sub: hidden ? '' : interpolate(dict.dailyCap, { amount: formatCompactToman(safe.capRial) }),
    progress,
    todayLabel: dict.spentToday,
    today: short(today),
    monthLabel: limit ? dict.monthOfBudget : dict.monthSpent,
    month: limit
      ? hidden
        ? MASK
        : `${formatCompactToman(month.expenseRial)} / ${formatCompactToman(limit)}`
      : short(month.expenseRial),
  };
}

const bridge:
  | { setState: (json: string) => void; requestPin: (wide: boolean) => Promise<boolean> }
  | undefined = Platform.OS === 'android' ? NativeModules.WidgetBridge : undefined;

let last = '';

/** Pushes fresh figures to the widget; skipped when nothing changed. */
export function pushWidgetState(): void {
  if (!bridge) {
    return;
  }
  const { snapshot, hydrated } = useFinanceStore.getState();
  if (!hydrated) {
    return;
  }
  const json = JSON.stringify(buildWidgetState(snapshot));
  if (json !== last) {
    last = json;
    bridge.setState(json);
  }
}

/** Keeps the widget in step with the data while the app runs. Returns unsubscribe. */
export function watchWidget(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  pushWidgetState();
  const unsubscribe = useFinanceStore.subscribe((state, prev) => {
    const a = state.snapshot;
    const b = prev.snapshot;
    if (a.transactions !== b.transactions || a.budgets !== b.budgets || a.settings !== b.settings) {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(pushWidgetState, 1500);
    }
  });
  return () => {
    if (timer) {
      clearTimeout(timer);
    }
    unsubscribe();
  };
}

/** Opens the launcher's «add widget» dialog; false when the launcher cannot do it. */
export async function requestWidgetPin(wide: boolean): Promise<boolean> {
  if (!bridge) {
    return false;
  }
  pushWidgetState();
  return bridge.requestPin(wide).catch(() => false);
}
