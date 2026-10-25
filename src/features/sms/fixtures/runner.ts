import type { SmsFixture } from './schema';
import { preprocessSms } from '../normalizer/preprocess';
import { detectBank } from '../detectors/bankDetector';
import { runSmsPipeline } from '../pipeline/run';
import { scanForSensitiveData } from '../privacy/scanner';

export type FieldResult = {
  field: string;
  pass: boolean;
  expected: unknown;
  actual: unknown;
};

export type FixtureRunResult = {
  id: string;
  passed: boolean;
  fields: FieldResult[];
  privacyBlocked?: boolean;
  privacyHits?: string[];
};

function cmp(field: string, expected: unknown, actual: unknown): FieldResult {
  const pass =
    expected == null
      ? true
      : expected === actual ||
        (typeof expected === 'number' && typeof actual === 'number' && expected === actual);
  return { field, pass, expected, actual };
}

export function runFixture(fixture: SmsFixture): FixtureRunResult {
  const privacy = scanForSensitiveData(fixture.message.sanitized);
  if (!privacy.ok) {
    return {
      id: fixture.id,
      passed: false,
      fields: [],
      privacyBlocked: true,
      privacyHits: privacy.hits,
    };
  }

  const sender = fixture.sender.sanitized ?? fixture.sender.raw ?? 'UNKNOWN';
  const result = runSmsPipeline({
    userId: 'fixture-user',
    accountId: 'fixture-acc',
    existing: [],
    raw: {
      sender,
      body: fixture.message.sanitized,
      receivedAt: new Date().toISOString(),
    },
  });

  const normalized = preprocessSms({
    sender,
    body: fixture.message.sanitized,
    receivedAt: new Date().toISOString(),
  });
  const bank = detectBank(normalized);

  const fields: FieldResult[] = [
    cmp('bankId', fixture.bankId, result.telemetry.bankId ?? bank.bankId),
    cmp('type', fixture.expected.type ?? fixture.transactionType, result.transaction?.type),
    cmp('amount', fixture.expected.amount, result.transaction?.amountRial),
    cmp('currency', fixture.expected.currency ?? 'IRR', result.transaction?.currency),
    cmp('cardLast4', fixture.expected.cardLast4, result.transaction?.cardLast4),
    cmp('balance', fixture.expected.balance, result.transaction?.balanceAfterRial),
    cmp('merchant', fixture.expected.merchant, result.transaction?.merchant),
  ];

  const required = fields.filter(f => f.expected != null && f.expected !== '');
  const passed = required.every(f => f.pass) && result.status !== 'unknown';

  return { id: fixture.id, passed, fields };
}
