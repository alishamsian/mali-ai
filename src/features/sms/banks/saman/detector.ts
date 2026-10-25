import type { DetectionResult, NormalizedSms } from '../../types';
export function detectSaman(_message: NormalizedSms): DetectionResult {
  return { matched: false, confidence: 0, bankId: 'saman' };
}
