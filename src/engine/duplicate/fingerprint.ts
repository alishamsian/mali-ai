import { sha256 } from 'js-sha256';
import type { Transaction, TransactionSource, TransactionType } from '../../types/finance';

export function buildFingerprint(input: {
  userId: string;
  bankId?: string;
  type: TransactionType;
  amountRial: number;
  date: string;
  cardLast4?: string;
  normalizedText?: string;
  source: TransactionSource;
  /** When present, fingerprints must stay unique per Android SMS. */
  sourceSmsId?: string;
}): string {
  const day = input.sourceSmsId ? input.date : input.date.slice(0, 16);
  const payload = [
    input.userId,
    input.bankId ?? '',
    input.type,
    String(input.amountRial),
    day,
    input.cardLast4 ?? '',
    input.normalizedText ?? '',
    input.source,
    input.sourceSmsId ?? '',
  ].join('|');
  return sha256(payload);
}

export function isExactDuplicate(existing: Transaction[], fingerprint: string): boolean {
  return existing.some(tx => tx.fingerprint === fingerprint);
}

export function findFuzzyDuplicates(
  existing: Transaction[],
  candidate: Pick<Transaction, 'accountId' | 'amountRial' | 'cardLast4' | 'transactionDate' | 'type'>,
  windowHours = 6,
): Transaction[] {
  const t = Date.parse(candidate.transactionDate);
  return existing.filter(tx => {
    if (tx.amountRial !== candidate.amountRial) {
      return false;
    }
    if (tx.type !== candidate.type) {
      return false;
    }
    if (candidate.cardLast4 && tx.cardLast4 && tx.cardLast4 !== candidate.cardLast4) {
      return false;
    }
    if (tx.accountId !== candidate.accountId && candidate.cardLast4 && tx.cardLast4 !== candidate.cardLast4) {
      return false;
    }
    const deltaH = Math.abs(Date.parse(tx.transactionDate) - t) / 36e5;
    return deltaH <= windowHours;
  });
}
