import type { Transaction } from '../../types/finance';

export interface BalanceGap {
  accountId: string;
  /** Positive: money arrived that no SMS explains; negative: money left unexplained. */
  gapRial: number;
  /** The two SMS the gap sits between. */
  fromDate: string;
  toDate: string;
}

/** Bank rounding and fee noise below this is ignored. */
const TOLERANCE_RIAL = 10_000;
const LOOKBACK_DAYS = 60;

/**
 * Walks each account's bank SMS in order: the balance after one message plus/minus the
 * next message's amount should equal the next message's balance. A difference means a
 * transaction happened that no SMS recorded (or one was deleted). Newest gap first.
 */
export function findBalanceGaps(transactions: Transaction[], now = new Date()): BalanceGap[] {
  const since = now.getTime() - LOOKBACK_DAYS * 86_400_000;
  const byAccount = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    if (tx.source !== 'android_sms' || tx.balanceAfterRial == null || tx.direction === 'internal') {
      continue;
    }
    const list = byAccount.get(tx.accountId) ?? [];
    list.push(tx);
    byAccount.set(tx.accountId, list);
  }
  const gaps: BalanceGap[] = [];
  for (const [accountId, list] of byAccount) {
    list.sort((a, b) => a.transactionDate.localeCompare(b.transactionDate));
    for (let i = 1; i < list.length; i += 1) {
      const prev = list[i - 1];
      const cur = list[i];
      if (Date.parse(cur.transactionDate) < since) {
        continue;
      }
      const signed = cur.direction === 'in' ? cur.amountRial : -cur.amountRial;
      const expected = (prev.balanceAfterRial ?? 0) + signed;
      const gapRial = (cur.balanceAfterRial ?? 0) - expected;
      if (Math.abs(gapRial) > TOLERANCE_RIAL) {
        gaps.push({ accountId, gapRial, fromDate: prev.transactionDate, toDate: cur.transactionDate });
      }
    }
  }
  return gaps.sort((a, b) => b.toDate.localeCompare(a.toDate));
}
