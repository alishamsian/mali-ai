import type { DetectionResult, NormalizedSms } from '../../types';
export function detectPasargad(_message: NormalizedSms): DetectionResult {
  return { matched: false, confidence: 0, bankId: 'pasargad' };
}
