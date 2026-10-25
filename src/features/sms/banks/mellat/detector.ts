import type { DetectionResult, NormalizedSms } from '../../types';
import { MELLAT_AMOUNT, MELLAT_BANK_MARK, MELLAT_SENDERS } from './patterns';

export function detectMellat(message: NormalizedSms): DetectionResult {
  const sender = message.sender.toLowerCase();
  const fromSender = MELLAT_SENDERS.some(s => sender.includes(s));
  const fromBody = MELLAT_BANK_MARK.test(message.body);
  const shape = MELLAT_AMOUNT.test(message.body);
  if (fromSender && (fromBody || shape)) {
    return { matched: true, confidence: 0.95, bankId: 'mellat' };
  }
  if (fromBody && shape) {
    return { matched: true, confidence: 0.9, bankId: 'mellat' };
  }
  if (fromSender && shape) {
    return { matched: true, confidence: 0.85, bankId: 'mellat' };
  }
  return { matched: false, confidence: fromSender ? 0.35 : 0, bankId: 'mellat' };
}
