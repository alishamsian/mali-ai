export type ConfidenceBand = 'auto' | 'review' | 'pending';

export function overallConfidence(parts: {
  bank: number;
  amount: number;
  type: number;
  currency: number;
  merchant: number;
}): number {
  return Number(
    (
      parts.bank * 0.25 +
      parts.amount * 0.3 +
      parts.type * 0.2 +
      parts.currency * 0.15 +
      parts.merchant * 0.1
    ).toFixed(2),
  );
}

export function bandFor(confidence: number): ConfidenceBand {
  if (confidence >= 0.9) {
    return 'auto';
  }
  if (confidence >= 0.6) {
    return 'review';
  }
  return 'pending';
}
