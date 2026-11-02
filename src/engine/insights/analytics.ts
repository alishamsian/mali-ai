import type { CategoryId, MonthlySnapshot, Transaction } from '../../types/finance';

/**
 * Money that left you. Only moves between your own accounts are left out: a paired
 * transfer (transferId) or a manual one (direction 'internal'). A card-to-card payment
 * to someone else is real spending even though the bank calls it «انتقال».
 */
export function isExpenseLike(tx: Transaction): boolean {
  return tx.direction === 'out' && !tx.transferId && !tx.debtId;
}

/** Money that reached you, with the same rule for your own transfers. */
export function isIncomeLike(tx: Transaction): boolean {
  return tx.direction === 'in' && !tx.transferId && !tx.debtId && !isRefund(tx);
}

/** Money coming back for an earlier purchase: it lowers spending, it is not income. */
export function isRefund(tx: Transaction): boolean {
  return (
    tx.direction === 'in' &&
    !tx.transferId &&
    !tx.debtId &&
    (tx.type === 'refund' || tx.type === 'reversal')
  );
}

export function monthlyTotals(transactions: Transaction[]): MonthlySnapshot {
  let incomeRial = 0;
  let expenseRial = 0;
  let transferRial = 0;
  const countedTransfers = new Set<string>();
  for (const tx of transactions) {
    // Only moves between own accounts are transfers; card-to-card to others is real money.
    if (tx.transferId) {
      if (!countedTransfers.has(tx.transferId)) {
        countedTransfers.add(tx.transferId);
        transferRial += tx.amountRial;
      }
      continue;
    }
    if (tx.direction === 'internal') {
      transferRial += tx.amountRial;
      continue;
    }
    if (isRefund(tx)) {
      expenseRial -= tx.amountRial;
    } else if (isIncomeLike(tx)) {
      incomeRial += tx.amountRial;
    } else if (isExpenseLike(tx)) {
      expenseRial += tx.amountRial;
    }
  }
  expenseRial = Math.max(0, expenseRial);
  const savingsRial = incomeRial - expenseRial;
  const savingsRate = incomeRial === 0 ? 0 : savingsRial / incomeRial;
  return { incomeRial, expenseRial, savingsRial, savingsRate, transferRial };
}

export function categoryTotals(transactions: Transaction[]): Record<CategoryId, number> {
  const out = {} as Record<CategoryId, number>;
  for (const tx of transactions) {
    if (isRefund(tx)) {
      out[tx.categoryId] = (out[tx.categoryId] ?? 0) - tx.amountRial;
    } else if (isExpenseLike(tx)) {
      out[tx.categoryId] = (out[tx.categoryId] ?? 0) + tx.amountRial;
    }
  }
  // A refund larger than what was spent in its category this period floors at zero.
  for (const id of Object.keys(out) as CategoryId[]) {
    out[id] = Math.max(0, out[id]);
  }
  return out;
}

export function percentChange(current: number, previous: number): number {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return ((current - previous) / previous) * 100;
}

export function budgetUtilization(spentRial: number, limitRial: number): number {
  if (limitRial <= 0) {
    return 0;
  }
  return spentRial / limitRial;
}
