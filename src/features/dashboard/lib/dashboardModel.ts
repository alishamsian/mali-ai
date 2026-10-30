import type { FinanceSnapshot } from '../../../database/schema/snapshot';
import { monthlyTotals, isExpenseLike, isRefund } from '../../../engine/insights/analytics';
import {
  financialMonthStart,
  financialMonthTransactions,
} from '../../../engine/insights/monthPeriod';
import { currentMonthlyLimitRial } from '../../../engine/insights/safeToSpend';
import { liquidBalanceRial } from '../../../engine/obligations/dues';
import { summarizeWealth } from '../../wealth/engine/portfolio';

export type DashboardInput = Pick<
  FinanceSnapshot,
  | 'accounts'
  | 'transactions'
  | 'settings'
  | 'budgets'
  | 'netWorthHistory'
  | 'installmentPlans'
  | 'cheques'
  | 'debts'
>;

/** A sample up to 3 days before «the same time last month» still counts as that time. */
const SAME_TIME_TOLERANCE_MS = 3 * 86_400_000;

function localDay(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Financial figures shared by the home layout; never contains presentation/demo values. */
export function buildDashboardModel(snapshot: DashboardInput, now = new Date()) {
  const windowStart = financialMonthStart(snapshot, now).getTime();
  const month = monthlyTotals(financialMonthTransactions(snapshot, 0, now));
  const wealth = summarizeWealth(snapshot, now);
  const cashRial = liquidBalanceRial(snapshot.accounts);
  const limit = currentMonthlyLimitRial(snapshot);
  const budgetRatio = limit != null ? month.expenseRial / limit : null;
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6 + index);
    return { key: localDay(date), date: date.toISOString(), rial: 0 };
  });
  const byDay = new Map(days.map(day => [day.key, day]));
  for (const tx of snapshot.transactions) {
    const at = new Date(tx.transactionDate);
    if (at.getTime() > now.getTime()) {
      continue;
    }
    const day = byDay.get(localDay(at));
    if (day && (isExpenseLike(tx) || isRefund(tx))) {
      day.rial += isRefund(tx) ? -tx.amountRial : tx.amountRial;
    }
  }
  days.forEach(day => {
    day.rial = Math.max(0, day.rial);
  });

  const history = (snapshot.netWorthHistory ?? [])
    .filter(point => Number.isFinite(point.assetsRial) && Date.parse(point.date) <= now.getTime())
    .slice()
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  // Change against the same point of last month (day 7 vs day 7), not the whole month:
  // a fair comparison early in the month, when most spending is still ahead.
  const previousStart = financialMonthStart(snapshot, now, -1).getTime();
  const sameTimeLastMonth = previousStart + (now.getTime() - windowStart);
  const baseline =
    history
      .filter(
        point =>
          Date.parse(point.date) <= sameTimeLastMonth &&
          sameTimeLastMonth - Date.parse(point.date) <= SAME_TIME_TOLERANCE_MS,
      )
      .at(-1) ?? null;
  const changePct =
    baseline && baseline.assetsRial > 0
      ? ((wealth.totalAssetsRial - baseline.assetsRial) / baseline.assetsRial) * 100
      : null;
  // The sparkline still shows this month's own samples.
  const observed = history.filter(point => Date.parse(point.date) >= windowStart);
  const trend = observed.length >= 2 ? observed.map(point => point.assetsRial) : [];
  if (trend.length >= 2 && trend[trend.length - 1] !== wealth.totalAssetsRial) {
    trend.push(wealth.totalAssetsRial);
  }
  return {
    totalAssetsRial: wealth.totalAssetsRial,
    cashRial,
    month,
    budgetRatio,
    budgetLimitRial: limit,
    week: days,
    trend,
    changePct,
    recent: snapshot.transactions
      .filter(tx => Date.parse(tx.transactionDate) <= now.getTime())
      .slice()
      .sort((a, b) => Date.parse(b.transactionDate) - Date.parse(a.transactionDate))
      .slice(0, 3),
  };
}

export type DashboardModel = ReturnType<typeof buildDashboardModel>;
