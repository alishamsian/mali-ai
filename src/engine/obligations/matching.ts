import type { Transaction } from '../../types/finance';
import type { DueKind, DueItem, ObligationsInput } from './dues';
import { upcomingDues } from './dues';
import { debtRemainingRial, daysUntil, type CalendarKind } from './schedule';

export interface DueMatch {
  /** due key + transaction id; used to dismiss a suggestion for good. */
  key: string;
  due: DueItem;
  transaction: Transaction;
}

const DAY_MS = 86_400_000;
const LOOKBACK_DAYS = 45;

/** Amount tolerance: installments vary a little (late fees, rounding); cheques do not. */
function amountMatches(kind: DueKind, due: number, paid: number): boolean {
  if (kind === 'installment') {
    return Math.abs(paid - due) <= Math.max(due * 0.01, 10_000);
  }
  return Math.abs(paid - due) <= due * 0.002;
}

/** How far before (-) / after (+) the due date a payment may land. Debts are checked
 * against their start date instead: most loans between friends have no due date. */
const WINDOW: Record<Exclude<DueKind, 'debt'>, [number, number]> = {
  installment: [-20, 15],
  cheque: [-5, 20],
};

/** Every open debt, due date or not; the due date defaults to when it was made. */
function openDebtDues(input: ObligationsInput, now: Date): DueItem[] {
  return input.debts
    .filter(d => debtRemainingRial(d) > 0)
    .map(d => {
      const dueDate = d.dueDate ?? d.date;
      const daysLeft = daysUntil(dueDate, now);
      return {
        key: `debt:${d.id}`,
        kind: 'debt' as const,
        refId: d.id,
        title: d.person,
        amountRial: debtRemainingRial(d),
        flow: d.direction === 'lent' ? ('in' as const) : ('out' as const),
        dueDate,
        daysLeft,
        overdue: Boolean(d.dueDate) && daysLeft < 0,
      };
    });
}

/** Transaction ids already linked to an installment, cheque or debt settlement. */
export function linkedTransactionIds(input: ObligationsInput): Set<string> {
  const ids = new Set<string>();
  input.plans.forEach(p => p.payments.forEach(x => x.transactionId && ids.add(x.transactionId)));
  input.cheques.forEach(c => c.transactionId && ids.add(c.transactionId));
  input.debts.forEach(d => d.settlements.forEach(s => s.transactionId && ids.add(s.transactionId)));
  return ids;
}

/**
 * Suggests which recent transactions look like an open due being paid or received, so
 * the user confirms with one tap instead of entering it twice. Each transaction and each
 * due is suggested at most once, closest date first.
 */
export function suggestDueMatches(
  input: ObligationsInput & { transactions: Transaction[] },
  now: Date,
  dismissed: ReadonlySet<string>,
  calendar: CalendarKind = 'jalali',
): DueMatch[] {
  const linked = linkedTransactionIds(input);
  const since = now.getTime() - LOOKBACK_DAYS * DAY_MS;
  const candidates = input.transactions.filter(
    tx =>
      !linked.has(tx.id) &&
      tx.type !== 'transfer' &&
      !tx.transferId &&
      (tx.direction === 'in' || tx.direction === 'out') &&
      Date.parse(tx.transactionDate) >= since,
  );
  // Dues up to two weeks ahead can already be paid early.
  const dues = [
    ...upcomingDues({ ...input, debts: [] }, now, 15, calendar),
    ...openDebtDues(input, now),
  ];

  type Scored = DueMatch & { distance: number };
  const scored: Scored[] = [];
  for (const due of dues) {
    const dueMs = Date.parse(due.dueDate);
    const debtStart =
      due.kind === 'debt' ? Date.parse(input.debts.find(d => d.id === due.refId)!.date) : 0;
    for (const tx of candidates) {
      if (tx.direction !== due.flow || !amountMatches(due.kind, due.amountRial, tx.amountRial)) {
        continue;
      }
      const txMs = Date.parse(tx.transactionDate);
      const offsetDays = (txMs - dueMs) / DAY_MS;
      if (due.kind === 'debt') {
        // Only money moving after the debt was made can settle it.
        if (txMs < debtStart) {
          continue;
        }
      } else {
        const [before, after] = WINDOW[due.kind];
        if (offsetDays < before || offsetDays > after) {
          continue;
        }
      }
      const key = `${due.key}|${tx.id}`;
      if (!dismissed.has(key)) {
        scored.push({ key, due, transaction: tx, distance: Math.abs(offsetDays) });
      }
    }
  }

  const usedTx = new Set<string>();
  const usedDue = new Set<string>();
  const out: DueMatch[] = [];
  for (const match of scored.sort((a, b) => a.distance - b.distance)) {
    if (usedTx.has(match.transaction.id) || usedDue.has(match.due.key)) {
      continue;
    }
    usedTx.add(match.transaction.id);
    usedDue.add(match.due.key);
    out.push({ key: match.key, due: match.due, transaction: match.transaction });
  }
  return out;
}
