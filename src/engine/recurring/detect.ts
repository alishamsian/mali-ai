import type { RecurringTransaction, Transaction } from '../../types/finance';

export function recurringId(merchant: string, amountRial: number): string {
  return `rec_${merchant}_${amountRial}`;
}

export function recurringFromTransactions(
  merchant: string,
  amountRial: number,
  userId: string,
  avgGapDays: number,
  nextDueIso: string,
  categoryId: RecurringTransaction['categoryId'] = 'bills',
): RecurringTransaction {
  let frequency: RecurringTransaction['frequency'] = 'monthly';
  if (avgGapDays <= 10) {
    frequency = 'weekly';
  } else if (avgGapDays >= 300) {
    frequency = 'yearly';
  }
  return {
    id: recurringId(merchant, amountRial),
    userId,
    merchant,
    amountRial,
    frequency,
    categoryId,
    nextExpectedDate: nextDueIso,
  };
}

export function detectRecurring(transactions: Transaction[], userId: string): RecurringTransaction[] {
  const groups = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    if (!tx.merchant || tx.direction !== 'out') {
      continue;
    }
    const key = `${tx.merchant}|${tx.amountRial}`;
    const list = groups.get(key) ?? [];
    list.push(tx);
    groups.set(key, list);
  }
  const result: RecurringTransaction[] = [];
  for (const [, list] of groups) {
    if (list.length < 2) {
      continue;
    }
    const sorted = [...list].sort((a, b) => a.transactionDate.localeCompare(b.transactionDate));
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i += 1) {
      gaps.push(
        Math.round(
          (Date.parse(sorted[i].transactionDate) - Date.parse(sorted[i - 1].transactionDate)) / 86400000,
        ),
      );
    }
    const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    const last = sorted[sorted.length - 1];
    const next = new Date(Date.parse(last.transactionDate) + avg * 86400000);
    result.push(
      recurringFromTransactions(
        last.merchant ?? '',
        last.amountRial,
        userId,
        avg,
        next.toISOString(),
        last.categoryId,
      ),
    );
  }
  return result;
}
