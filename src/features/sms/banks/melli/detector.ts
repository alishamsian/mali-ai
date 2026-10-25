import type { DetectionResult, NormalizedSms } from '../../types';
import { MELLI_ACCOUNT, MELLI_BALANCE, MELLI_SENDERS, MELLI_SIGNED_AMOUNT } from './patterns';

export function detectMelli(message: NormalizedSms): DetectionResult {
  const sender = message.sender.toLowerCase();
  const fromSender = MELLI_SENDERS.some(s => sender.includes(s));
  const fromBody = /بانک ملی/.test(message.body);
  const shape = MELLI_SIGNED_AMOUNT.test(message.body) && (MELLI_ACCOUNT.test(message.body) || MELLI_BALANCE.test(message.body));
  if (fromSender && (fromBody || shape)) {
    return { matched: true, confidence: 0.96, bankId: 'melli' };
  }
  if (fromBody && shape) {
    return { matched: true, confidence: 0.9, bankId: 'melli' };
  }
  if (fromSender && shape) {
    return { matched: true, confidence: 0.88, bankId: 'melli' };
  }
  return { matched: false, confidence: fromSender ? 0.4 : 0, bankId: 'melli' };
}
