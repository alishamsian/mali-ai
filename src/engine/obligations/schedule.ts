import type { InstallmentPlan, PersonalDebt } from '../../types/obligations';
import { addJalaliMonths } from '../../utils/dates/jalali';

export type CalendarKind = 'jalali' | 'gregorian';

const DAY_MS = 86_400_000;

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Whole days from today to `iso` (negative = in the past). */
export function daysUntil(iso: string, now: Date): number {
  return Math.round((startOfDay(new Date(iso)).getTime() - startOfDay(now).getTime()) / DAY_MS);
}

function addGregorianMonths(iso: string, months: number): string {
  const d = new Date(iso);
  const day = d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1, d.getHours(), d.getMinutes());
  // Clamp 31 Jan + 1 month to the last day of February instead of rolling into March.
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return target.toISOString();
}

/** Installments fall on the same calendar day each month (Jalali by default, as banks do). */
export function installmentDueDate(
  plan: Pick<InstallmentPlan, 'firstDueDate'>,
  index: number,
  calendar: CalendarKind = 'jalali',
): string {
  if (index === 0) {
    return plan.firstDueDate;
  }
  return calendar === 'gregorian'
    ? addGregorianMonths(plan.firstDueDate, index)
    : addJalaliMonths(plan.firstDueDate, index);
}

export interface InstallmentRow {
  index: number;
  dueDate: string;
  amountRial: number;
  paid: boolean;
  paidAt?: string;
  transactionId?: string;
  overdue: boolean;
}

export function installmentSchedule(
  plan: InstallmentPlan,
  now: Date,
  calendar: CalendarKind = 'jalali',
): InstallmentRow[] {
  const paidByIndex = new Map(plan.payments.map(p => [p.index, p]));
  const today = startOfDay(now).getTime();
  return Array.from({ length: plan.totalCount }, (_, index) => {
    const dueDate = installmentDueDate(plan, index, calendar);
    const payment = paidByIndex.get(index);
    return {
      index,
      dueDate,
      amountRial: payment?.amountRial ?? plan.installmentRial,
      paid: Boolean(payment),
      paidAt: payment?.paidAt,
      transactionId: payment?.transactionId,
      overdue: !payment && startOfDay(new Date(dueDate)).getTime() < today,
    };
  });
}

export interface PlanStatus {
  paidCount: number;
  remainingCount: number;
  paidRial: number;
  remainingRial: number;
  /** Sum of all installments as scheduled. */
  totalRial: number;
  /** total - principal, when the principal is known. */
  costOfCreditRial?: number;
  /** Simple yearly cost as a share of the principal, when it is known. */
  costOfCreditYearlyPct?: number;
  next?: InstallmentRow;
  overdue: InstallmentRow[];
  finishDate: string;
  progress: number;
  done: boolean;
}

export function planStatus(
  plan: InstallmentPlan,
  now: Date,
  calendar: CalendarKind = 'jalali',
): PlanStatus {
  const rows = installmentSchedule(plan, now, calendar);
  const paid = rows.filter(r => r.paid);
  const unpaid = rows.filter(r => !r.paid);
  const totalRial = plan.installmentRial * plan.totalCount;
  const paidRial = paid.reduce((sum, r) => sum + r.amountRial, 0);
  const costOfCreditRial =
    plan.principalRial && plan.principalRial > 0 ? totalRial - plan.principalRial : undefined;
  const years = plan.totalCount / 12;
  return {
    paidCount: paid.length,
    remainingCount: unpaid.length,
    paidRial,
    remainingRial: unpaid.reduce((sum, r) => sum + r.amountRial, 0),
    totalRial,
    costOfCreditRial,
    costOfCreditYearlyPct:
      costOfCreditRial != null && years > 0
        ? Math.round((costOfCreditRial / plan.principalRial! / years) * 1000) / 10
        : undefined,
    next: unpaid[0],
    overdue: unpaid.filter(r => r.overdue),
    finishDate: rows[rows.length - 1]?.dueDate ?? plan.firstDueDate,
    progress: plan.totalCount > 0 ? paid.length / plan.totalCount : 1,
    done: unpaid.length === 0,
  };
}

export function debtSettledRial(debt: PersonalDebt): number {
  return debt.settlements.reduce((sum, s) => sum + s.amountRial, 0);
}

export function debtRemainingRial(debt: PersonalDebt): number {
  return Math.max(0, debt.amountRial - debtSettledRial(debt));
}

export interface PersonBalance {
  person: string;
  /** Positive: they owe me. Negative: I owe them. */
  netRial: number;
  openDebts: PersonalDebt[];
}

/** Open debts grouped by person (case- and space-insensitive), largest balance first. */
export function balancesByPerson(debts: PersonalDebt[]): PersonBalance[] {
  const byKey = new Map<string, PersonBalance>();
  for (const debt of debts) {
    const remaining = debtRemainingRial(debt);
    if (remaining <= 0) {
      continue;
    }
    const key = debt.person.trim().replace(/\s+/g, ' ').toLowerCase();
    const entry = byKey.get(key) ?? { person: debt.person.trim(), netRial: 0, openDebts: [] };
    entry.netRial += debt.direction === 'lent' ? remaining : -remaining;
    entry.openDebts.push(debt);
    byKey.set(key, entry);
  }
  return [...byKey.values()].sort((a, b) => Math.abs(b.netRial) - Math.abs(a.netRial));
}
