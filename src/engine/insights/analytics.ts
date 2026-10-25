import type { CategoryId, MonthlySnapshot, Transaction } from '../../types/finance';

export function isExpenseLike(tx: Transaction): boolean {
  return tx.direction === 'out' && tx.type !== 'transfer' && !tx.transferId;
}

export function isIncomeLike(tx: Transaction): boolean {
  return tx.direction === 'in' && tx.type !== 'transfer' && !tx.transferId;
}

export function monthlyTotals(transactions: Transaction[]): MonthlySnapshot {
  let incomeRial = 0;
  let expenseRial = 0;
  let transferRial = 0;
  const countedTransfers = new Set<string>();
  for (const tx of transactions) {
    if (tx.transferId || tx.type === 'transfer') {
      if (tx.transferId) {
        if (!countedTransfers.has(tx.transferId)) {
          countedTransfers.add(tx.transferId);
          transferRial += tx.amountRial;
        }
      } else if (tx.direction === 'out') {
        transferRial += tx.amountRial;
      }
      continue;
    }
    if (isIncomeLike(tx)) {
      incomeRial += tx.amountRial;
    } else if (isExpenseLike(tx)) {
      expenseRial += tx.amountRial;
    }
  }
  const savingsRial = incomeRial - expenseRial;
  const savingsRate = incomeRial === 0 ? 0 : savingsRial / incomeRial;
  return { incomeRial, expenseRial, savingsRial, savingsRate, transferRial };
}

export function categoryTotals(transactions: Transaction[]): Record<CategoryId, number> {
  const out = {} as Record<CategoryId, number>;
  for (const tx of transactions) {
    if (!isExpenseLike(tx)) {
      continue;
    }
    out[tx.categoryId] = (out[tx.categoryId] ?? 0) + tx.amountRial;
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
