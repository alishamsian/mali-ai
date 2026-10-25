/**
 * Fixture schema for REAL sanitized SMS regression samples.
 * Never invent Iranian bank SMS — only infrastructure + empty placeholders.
 */

export type FixtureStatus = 'real' | 'synthetic' | 'unknown' | 'redacted' | 'NEEDS_FIXTURES';

export type SmsFixture = {
  id: string;
  status: FixtureStatus;
  bankId: string;
  sender: {
    raw: string | null;
    sanitized: string | null;
    verified: boolean;
  };
  message: {
    sanitized: string;
  };
  transactionType?: string | null;
  expected: {
    amount: number | null;
    currency: 'IRR' | 'IRT' | null;
    cardLast4: string | null;
    balance: number | null;
    merchant: string | null;
    type?: string | null;
  };
  metadata: {
    source: 'manual' | 'android_capture' | 'unknown';
    parserVersion: string | null;
    collectionDate?: string | null;
  };
};

export function isRunnableFixture(f: SmsFixture): boolean {
  return f.status === 'real' && Boolean(f.message.sanitized?.trim());
}
