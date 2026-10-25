import type { DetectionResult, NormalizedSms } from '../../types';
export function detectTejarat(_message: NormalizedSms): DetectionResult {
  return { matched: false, confidence: 0, bankId: 'tejarat' };
}
