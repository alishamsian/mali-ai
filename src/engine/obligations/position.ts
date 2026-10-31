import type { FinanceSnapshot } from '../../database/schema/snapshot';
import { financialMonthStart } from '../insights/monthPeriod';
import { debtRemainingRial, installmentSchedule, type CalendarKind } from './schedule';
import type { ObligationsInput } from './dues';

export type MonthPosition = {
  /** Start of the financial month, local midnight. */
  start: Date;
  /** I must pay this much: unpaid installments, issued cheques, debts I owe. */
  payRial: number;
  /** I should receive this much: received cheques and money lent. */
  receiveRial: number;
  /** Open overdue items carried into the first month. */
  overdueRial: number;
};

export type Position = {
  months: MonthPosition[];
  /** Everything still open, due dates aside. */
  totalPayRial: number;
  totalReceiveRial: number;
  /** Open installments per kind, for the «what makes up my debt» split. */
  split: { installments: number; cheques: number; debts: number };
};

type Dated = { at: number; rial: number; flow: 'out' | 'in' };

/**
 * What I owe and am owed: per financial month for the next `months`, and in total.
 * Overdue items land in the first month (they still have to be settled); debts with no
 * due date count only in the totals.
 */
export function obligationsPosition(
  input: ObligationsInput,
  snapshot: Pick<FinanceSnapshot, 'settings' | 'transactions'>,
  now: Date,
  months = 4,
  calendar: CalendarKind = 'jalali',
): Position {
  const items: Dated[] = [];
  const split = { installments: 0, cheques: 0, debts: 0 };
  let totalPay = 0;
  let totalReceive = 0;
  for (const plan of input.plans) {
    const open = installmentSchedule(plan, now, calendar).filter(row => !row.paid);
    for (const row of open) {
      items.push({ at: Date.parse(row.dueDate), rial: row.amountRial, flow: 'out' });
    }
    // A plan that never ends adds only its next instalment to the total owed.
    const owed = plan.openEnded ? open.slice(0, 1) : open;
    for (const row of owed) {
      totalPay += row.amountRial;
      split.installments += row.amountRial;
    }
  }
  for (const cheque of input.cheques) {
    if (cheque.status !== 'pending') {
      continue;
    }
    const flow = cheque.direction === 'issued' ? 'out' : 'in';
    items.push({ at: Date.parse(cheque.dueDate), rial: cheque.amountRial, flow });
    if (flow === 'out') {
      totalPay += cheque.amountRial;
      split.cheques += cheque.amountRial;
    } else {
      totalReceive += cheque.amountRial;
    }
  }
  for (const debt of input.debts) {
    const remaining = debtRemainingRial(debt);
    if (remaining <= 0) {
      continue;
    }
    const flow = debt.direction === 'lent' ? 'in' : 'out';
    if (debt.dueDate) {
      items.push({ at: Date.parse(debt.dueDate), rial: remaining, flow });
    }
    if (flow === 'out') {
      totalPay += remaining;
      split.debts += remaining;
    } else {
      totalReceive += remaining;
    }
  }

  const starts = Array.from({ length: months + 1 }, (_, k) =>
    financialMonthStart(snapshot, now, k).getTime(),
  );
  const out: MonthPosition[] = starts.slice(0, months).map(start => ({
    start: new Date(start),
    payRial: 0,
    receiveRial: 0,
    overdueRial: 0,
  }));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  for (const item of items) {
    let k = starts.findIndex(
      (_, i) => i < months && item.at >= starts[i] && item.at < starts[i + 1],
    );
    if (item.at < today) {
      k = 0;
      if (item.flow === 'out') {
        out[0].overdueRial += item.rial;
      }
    }
    if (k < 0) {
      continue;
    }
    if (item.flow === 'out') {
      out[k].payRial += item.rial;
    } else {
      out[k].receiveRial += item.rial;
    }
  }
  return { months: out, totalPayRial: totalPay, totalReceiveRial: totalReceive, split };
}
