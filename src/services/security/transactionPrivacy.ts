import type { Transaction } from '../../types/finance';
import { sanitizeSmsText } from '../../features/sms/privacy/sanitize';
import { toEnglishDigits } from '../../utils/numbers/digits';

/** A single export boundary for new and legacy SMS transactions. */
export function transactionForExport(tx: Transaction): Omit<Transaction, 'sourceSmsPreview'> {
  const rest = { ...tx };
  delete rest.sourceSmsPreview;
  if (tx.source !== 'android_sms' && tx.source !== 'ios_message_filter') {
    return rest;
  }
  return {
    ...rest,
    // Older generic parsers copied the SMS body into description. Never export it.
    description: tx.type,
    merchant: tx.merchant ? sanitizeSmsText(toEnglishDigits(tx.merchant)).sanitized : undefined,
  };
}
