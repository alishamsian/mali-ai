import type { Transaction } from '../../types/finance';

export function findCrossSourceDuplicate(
  existing: Transaction[],
  candidate: Pick<Transaction, 'amountRial' | 'direction' | 'transactionDate' | 'merchant' | 'id' | 'type'>,
  windowHours = 48,
): Transaction | undefined {
  const t = Date.parse(candidate.transactionDate);
  return existing.find(tx => {
    if (tx.id === candidate.id) {
      return false;
    }
    if (tx.type === 'transfer' || candidate.type === 'transfer' || tx.transferId) {
      return false;
    }
    if (tx.amountRial !== candidate.amountRial || tx.direction !== candidate.direction) {
      return false;
    }
    const hours = Math.abs(Date.parse(tx.transactionDate) - t) / 36e5;
    if (hours > windowHours) {
      return false;
    }
    const a = (tx.merchant ?? '').trim();
    const b = (candidate.merchant ?? '').trim();
    if (a && b && a !== b && !a.includes(b) && !b.includes(a)) {
      return false;
    }
    return true;
  });
}
