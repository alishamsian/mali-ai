import type { CategoryId, MonthlySnapshot } from '../../types/finance';
import { interpolate, t } from '../../i18n';
import { formatTomanLabel } from '../../utils/currency/money';
import { toPersianDigits } from '../../utils/numbers/digits';
import type { ProIntel } from './pro';

export function buildRecapShareMessage(
  dict: ReturnType<typeof t>,
  intel: ProIntel,
  stats: MonthlySnapshot,
  total: number,
  hidden: boolean,
  period: string,
): string {
  const mask = (amount: number, opts?: { sign?: boolean }) =>
    hidden ? '••••' : formatTomanLabel(amount, opts);
  const next = intel.recurring[0];
  return [
    interpolate(dict.insights.shareHeader, { brief: dict.insights.brief, period }),
    interpolate(dict.insights.shareGrade, {
      grade: intel.grade,
      score: toPersianDigits(intel.healthScore),
    }),
    interpolate(dict.insights.shareBalance, { amount: mask(total) }),
    interpolate(dict.insights.shareIncome, { amount: mask(stats.incomeRial) }),
    interpolate(dict.insights.shareExpense, { amount: mask(stats.expenseRial) }),
    interpolate(dict.insights.shareSavings, { amount: mask(stats.savingsRial) }),
    interpolate(dict.insights.savingsPct, { n: Math.round(intel.savingsRate * 100) }),
    interpolate(dict.insights.shareForecast, { amount: mask(intel.forecastMonthExpenseRial) }),
    interpolate(dict.insights.sharePace, { ratio: intel.paceRatio }),
    intel.runwayDays != null
      ? interpolate(dict.insights.shareRunway, { days: intel.runwayDays })
      : '',
    intel.topCategoryId
      ? interpolate(dict.insights.shareConcentration, {
          label: dict.insights.concentration,
          name: dict.categories[intel.topCategoryId as CategoryId],
          pct: Math.round(intel.topCategoryShare * 100),
        })
      : '',
    next
      ? interpolate(dict.insights.shareNextDue, {
          label: dict.insights.nextDue,
          merchant: next.merchant,
          amount: mask(next.amountRial),
        })
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}
