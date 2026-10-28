import type { SplitExpense, SplitGroup } from '../../types/obligations';

/**
 * Each member's share of one expense, in whole Rial. Weights split it proportionally;
 * leftover Rial from rounding go to the largest shares so the parts add up exactly.
 */
export function expenseShares(expense: SplitExpense): Map<string, number> {
  const entries = Object.entries(expense.shares).filter(([, w]) => w > 0);
  const totalWeight = entries.reduce((s, [, w]) => s + w, 0);
  const shares = new Map<string, number>();
  if (totalWeight <= 0) {
    return shares;
  }
  let assigned = 0;
  const exact = entries.map(([id, w]) => {
    const value = (expense.amountRial * w) / totalWeight;
    const floor = Math.floor(value);
    assigned += floor;
    shares.set(id, floor);
    return { id, rest: value - floor };
  });
  let leftover = expense.amountRial - assigned;
  for (const { id } of exact.sort((a, b) => b.rest - a.rest)) {
    if (leftover <= 0) {
      break;
    }
    shares.set(id, shares.get(id)! + 1);
    leftover -= 1;
  }
  return shares;
}

export interface MemberSummary {
  memberId: string;
  paidRial: number;
  shareRial: number;
  /** Positive: the group owes them. Negative: they owe the group. */
  netRial: number;
}

export function memberSummaries(group: SplitGroup): MemberSummary[] {
  const paid = new Map<string, number>();
  const share = new Map<string, number>();
  const settled = new Map<string, number>();
  for (const m of group.members) {
    paid.set(m.id, 0);
    share.set(m.id, 0);
    settled.set(m.id, 0);
  }
  for (const expense of group.expenses) {
    paid.set(expense.paidBy, (paid.get(expense.paidBy) ?? 0) + expense.amountRial);
    for (const [id, amount] of expenseShares(expense)) {
      share.set(id, (share.get(id) ?? 0) + amount);
    }
  }
  // Paying someone back raises your balance and lowers theirs.
  for (const p of group.payments) {
    settled.set(p.from, (settled.get(p.from) ?? 0) + p.amountRial);
    settled.set(p.to, (settled.get(p.to) ?? 0) - p.amountRial);
  }
  return group.members.map(m => ({
    memberId: m.id,
    paidRial: paid.get(m.id) ?? 0,
    shareRial: share.get(m.id) ?? 0,
    netRial: (paid.get(m.id) ?? 0) - (share.get(m.id) ?? 0) + (settled.get(m.id) ?? 0),
  }));
}

export interface SettleTransfer {
  from: string;
  to: string;
  amountRial: number;
}

/**
 * Fewest practical payments to settle everyone: repeatedly match the largest debtor
 * with the largest creditor. Amounts under `minRial` (rounding dust) are ignored.
 */
export function settleUp(summaries: MemberSummary[], minRial = 1_000): SettleTransfer[] {
  const creditors = summaries
    .filter(s => s.netRial >= minRial)
    .map(s => ({ id: s.memberId, amount: s.netRial }))
    .sort((a, b) => b.amount - a.amount);
  const debtors = summaries
    .filter(s => s.netRial <= -minRial)
    .map(s => ({ id: s.memberId, amount: -s.netRial }))
    .sort((a, b) => b.amount - a.amount);
  const transfers: SettleTransfer[] = [];
  let c = 0;
  let d = 0;
  while (c < creditors.length && d < debtors.length) {
    const amount = Math.min(creditors[c].amount, debtors[d].amount);
    if (amount >= minRial) {
      transfers.push({ from: debtors[d].id, to: creditors[c].id, amountRial: amount });
    }
    creditors[c].amount -= amount;
    debtors[d].amount -= amount;
    if (creditors[c].amount < minRial) {
      c += 1;
    }
    if (debtors[d].amount < minRial) {
      d += 1;
    }
  }
  return transfers;
}

export function groupTotalRial(group: SplitGroup): number {
  return group.expenses.reduce((s, e) => s + e.amountRial, 0);
}

export function isGroupSettled(group: SplitGroup): boolean {
  return group.expenses.length > 0 && settleUp(memberSummaries(group)).length === 0;
}
