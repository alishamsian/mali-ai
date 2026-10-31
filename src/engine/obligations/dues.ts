import type { FinancialAccount } from '../../types/finance';
import type { Cheque, InstallmentPlan, PersonalDebt } from '../../types/obligations';
import {
  daysUntil,
  debtRemainingRial,
  installmentSchedule,
  planStatus,
  type CalendarKind,
} from './schedule';

export type DueKind = 'installment' | 'cheque' | 'debt';

export interface DueItem {
  /** Stable key: kind:refId[:index]. */
  key: string;
  kind: DueKind;
  refId: string;
  /** Installment number for installment dues. */
  index?: number;
  title: string;
  /** Lender, counterparty or person. */
  party?: string;
  amountRial: number;
  /** out = money leaves me; in = money comes to me. */
  flow: 'out' | 'in';
  dueDate: string;
  daysLeft: number;
  overdue: boolean;
}

export interface ObligationsInput {
  plans: InstallmentPlan[];
  cheques: Cheque[];
  debts: PersonalDebt[];
}

/**
 * Everything still open that is overdue or due within `horizonDays`: overdue first
 * (oldest first), then by due date.
 */
export function upcomingDues(
  input: ObligationsInput,
  now: Date,
  horizonDays = 30,
  calendar: CalendarKind = 'jalali',
): DueItem[] {
  const out: DueItem[] = [];
  const push = (item: Omit<DueItem, 'daysLeft' | 'overdue'>) => {
    const daysLeft = daysUntil(item.dueDate, now);
    if (daysLeft <= horizonDays) {
      out.push({ ...item, daysLeft, overdue: daysLeft < 0 });
    }
  };

  for (const plan of input.plans) {
    for (const row of installmentSchedule(plan, now, calendar)) {
      if (row.paid) {
        continue;
      }
      push({
        key: `installment:${plan.id}:${row.index}`,
        kind: 'installment',
        refId: plan.id,
        index: row.index,
        title: plan.title,
        party: plan.lender,
        amountRial: row.amountRial,
        flow: 'out',
        dueDate: row.dueDate,
      });
    }
  }
  for (const cheque of input.cheques) {
    if (cheque.status !== 'pending') {
      continue;
    }
    push({
      key: `cheque:${cheque.id}`,
      kind: 'cheque',
      refId: cheque.id,
      title: cheque.counterparty,
      party: cheque.bankName,
      amountRial: cheque.amountRial,
      flow: cheque.direction === 'issued' ? 'out' : 'in',
      dueDate: cheque.dueDate,
    });
  }
  for (const debt of input.debts) {
    const remaining = debtRemainingRial(debt);
    if (!debt.dueDate || remaining <= 0) {
      continue;
    }
    push({
      key: `debt:${debt.id}`,
      kind: 'debt',
      refId: debt.id,
      title: debt.person,
      amountRial: remaining,
      flow: debt.direction === 'lent' ? 'in' : 'out',
      dueDate: debt.dueDate,
    });
  }
  return out.sort((a, b) => {
    if (a.overdue !== b.overdue) {
      return a.overdue ? -1 : 1;
    }
    return Date.parse(a.dueDate) - Date.parse(b.dueDate);
  });
}

const LIQUID_KINDS = new Set<FinancialAccount['kind']>(['bank', 'cash', 'card', 'wallet']);

export function liquidBalanceRial(accounts: FinancialAccount[]): number {
  return accounts
    .filter(
      a =>
        LIQUID_KINDS.has(a.kind) &&
        (a.assetClass == null || a.assetClass === 'bank' || a.assetClass === 'cash'),
    )
    .reduce((sum, a) => sum + (a.balanceRial || 0), 0);
}

export interface MonthEndForecast {
  liquidRial: number;
  outRial: number;
  inRial: number;
  projectedRial: number;
  /** Dues counted: overdue ones plus everything due before `until`. */
  items: DueItem[];
  shortfall: boolean;
}

/**
 * Cash at hand after every open due before `until` (overdue ones included, since they
 * still have to be paid). Expected spending is not guessed here; this is the floor.
 */
export function monthEndForecast(
  input: ObligationsInput & { accounts: FinancialAccount[] },
  now: Date,
  until: Date,
  calendar: CalendarKind = 'jalali',
): MonthEndForecast {
  const horizon = Math.max(0, daysUntil(until.toISOString(), now) - 1);
  const items = upcomingDues(input, now, horizon, calendar);
  const outRial = items.filter(i => i.flow === 'out').reduce((s, i) => s + i.amountRial, 0);
  const inRial = items.filter(i => i.flow === 'in').reduce((s, i) => s + i.amountRial, 0);
  const liquidRial = liquidBalanceRial(input.accounts);
  const projectedRial = liquidRial - outRial + inRial;
  return { liquidRial, outRial, inRial, projectedRial, items, shortfall: projectedRial < 0 };
}

export interface ObligationsPosition {
  /** Unpaid installments, money borrowed from people, issued cheques not yet cleared. */
  owedRial: number;
  /** Money lent to people and received cheques not yet cleared. */
  owedToMeRial: number;
}

/** What the cheques/installments/debts section adds to the balance sheet. */
export function obligationsPosition(
  input: ObligationsInput,
  now: Date,
  calendar: CalendarKind = 'jalali',
): ObligationsPosition {
  let owedRial = 0;
  let owedToMeRial = 0;
  for (const plan of input.plans) {
    owedRial += planStatus(plan, now, calendar).remainingRial;
  }
  for (const debt of input.debts) {
    const remaining = debtRemainingRial(debt);
    if (debt.direction === 'borrowed') {
      owedRial += remaining;
    } else {
      owedToMeRial += remaining;
    }
  }
  for (const cheque of input.cheques) {
    if (cheque.status !== 'pending') {
      continue;
    }
    if (cheque.direction === 'issued') {
      owedRial += cheque.amountRial;
    } else {
      owedToMeRial += cheque.amountRial;
    }
  }
  return { owedRial, owedToMeRial };
}
