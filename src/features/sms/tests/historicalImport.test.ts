import { historicalWindowMs, runHistoricalSmsImport } from '../import/historicalImport';
import { looksFinancialCandidate, hasTransactionSignals } from '../filters/financialCandidate';
import { sanitizeSmsText } from '../privacy/sanitize';
import { scanForSensitiveData } from '../privacy/scanner';
import { detectBank } from '../detectors/bankDetector';
import { preprocessSms } from '../normalizer/preprocess';
import { runFixture } from '../fixtures/runner';
import type { SmsFixture } from '../fixtures/schema';
import { patternHashFor } from '../validators/unknown';
import { collectSenderCandidates, groupByFormat } from '../discovery/formatDiscovery';

describe('historical window', () => {
  it('starts at previous calendar month 00:00 local → now', () => {
    const now = Date.parse('2026-08-26T15:00:00.000Z');
    const { minDateMs, maxDateMs } = historicalWindowMs(30, now);
    expect(maxDateMs).toBe(now);
    const start = new Date(now);
    const expected = new Date(start.getFullYear(), start.getMonth() - 1, 1, 0, 0, 0, 0).getTime();
    expect(minDateMs).toBe(expected);
  });
});

describe('financial candidate gate', () => {
  it('rejects OTP-like noise without transaction keywords', () => {
    expect(looksFinancialCandidate('رمز پویا 123456')).toBe(false);
    expect(hasTransactionSignals('کد 998877')).toBe(false);
  });

  it('accepts bank transfer text', () => {
    expect(hasTransactionSignals('بانک ملت واریز 1500000 ریال مانده 10')).toBe(true);
  });
});

describe('bank detection without exclusive sender', () => {
  it('matches Mellat from body keyword alone', () => {
    const n = preprocessSms({
      sender: 'unknown-provider',
      body: 'بانک ملت\nبرداشت 250000 ریال\nمانده 1000000',
      receivedAt: '2026-08-26T10:00:00.000Z',
    });
    const d = detectBank(n);
    expect(d.matched).toBe(true);
    expect(d.bankId).toBe('mellat');
  });
});

describe('sanitizer + privacy', () => {
  it('masks full card and blocks unsanitized export', () => {
    const raw = 'خرید کارت 6037991234567890 مبلغ 10000';
    const { sanitized } = sanitizeSmsText(raw);
    expect(sanitized).toContain('****7890');
    expect(sanitized).not.toContain('6037991234567890');
    expect(scanForSensitiveData(raw).ok).toBe(false);
    expect(scanForSensitiveData(sanitized).ok).toBe(true);
  });
});

describe('discovery', () => {
  it('groups formats by pattern hash', () => {
    const groups = groupByFormat([
      { bankId: 'melli', body: 'انتقال:1000+\nحساب:1' },
      { bankId: 'melli', body: 'انتقال:2000+\nحساب:2' },
      { bankId: 'melli', body: 'خرید:3000-\nحساب:3' },
    ]);
    expect(groups.length).toBeGreaterThanOrEqual(1);
    expect(patternHashFor('انتقال:1000+\nحساب:1')).toBe(patternHashFor('انتقال:2000+\nحساب:2'));
  });

  it('collects sender candidates as unverified', () => {
    const c = collectSenderCandidates([
      { sender: 'A', bankId: 'mellat' },
      { sender: 'A', bankId: 'mellat' },
      { sender: 'B', bankId: 'mellat' },
    ]);
    expect(c[0]?.verified).toBe(false);
    expect(c[0]?.count).toBe(2);
  });
});

describe('historical import pipeline', () => {
  it('processes all known-sender rows without body financial hard-drop', async () => {
    const rows = [
      {
        sourceSmsId: '1',
        sender: '9830009417',
        body: 'بانك ملي ايران\nانتقال:1,500,000+\nحساب:61008\nمانده:117,896,079\n0603-19:36',
        receivedAt: new Date(Date.now() - 1000).toISOString(),
      },
      {
        sourceSmsId: '3',
        sender: '9909',
        body: 'بانک ملت\nپیام بدون کلیدواژه مالی آشنا',
        receivedAt: new Date(Date.now() - 3000).toISOString(),
      },
    ];
    const kinds: string[] = [];
    const progress: string[] = [];
    const result = await runHistoricalSmsImport({
      options: { forceFull: true },
      verifiedSenders: ['9830009417', '9909'],
      collectRows: async () => ({
        rows,
        perSenderCounts: { '9830009417': 1, '9909': 1 },
      }),
      ingest: payload => {
        kinds.push(payload.sender);
        return { kind: payload.sourceSmsId === '3' ? 'unknown' : 'created' };
      },
      onProgress: p => progress.push(p.phase),
    });
    expect(progress).toContain('counting');
    expect(result.phase).toBe('done');
    expect(result.scanned).toBe(2);
    expect(kinds).toEqual(['9830009417', '9909']);
    expect(result.unknown).toBe(1);
    expect(result.transactions).toBe(1);

    const cancelled = await runHistoricalSmsImport({
      options: { forceFull: true },
      verifiedSenders: ['9909'],
      collectRows: async () => ({ rows, perSenderCounts: {} }),
      ingest: () => ({ kind: 'ignored' }),
      isCancelled: () => true,
    });
    expect(cancelled.phase).toBe('cancelled');
  });
});

describe('fixture runner', () => {
  it('passes the real sanitized Melli deposit fixture', () => {
    const fixture: SmsFixture = require('../../../../tests/fixtures/sms/melli/deposit/melli-deposit-001.json');
    const result = runFixture(fixture);
    expect(result.privacyBlocked).toBeFalsy();
    expect(result.passed).toBe(true);
  });

  it('skips empty NEEDS_FIXTURES placeholders', () => {
    const fixture: SmsFixture = {
      id: 'empty',
      status: 'NEEDS_FIXTURES',
      bankId: 'mellat',
      sender: { raw: null, sanitized: null, verified: false },
      message: { sanitized: '' },
      expected: { amount: null, currency: null, cardLast4: null, balance: null, merchant: null },
      metadata: { source: 'unknown', parserVersion: null },
    };
    const result = runFixture({ ...fixture, status: 'real', message: { sanitized: 'x' } });
    expect(result.passed).toBe(false);
  });
});
