import { buildSanitizedBackup, validateBackupJson } from './backup';
import { emptySnapshot } from '../../database/schema/snapshot';
import type { Transaction, UnknownSmsRecord } from '../../types/finance';

describe('backup security', () => {
  it('strips sms previews and unknown sms from export', () => {
    const snap = emptySnapshot();
    const tx = {
      id: 'tx_1',
      userId: snap.profile.id,
      accountId: 'acc_1',
      type: 'purchase',
      direction: 'out',
      amountRial: 1000,
      currency: 'IRT',
      categoryId: 'food',
      fingerprint: 'fp1',
      confidence: 1,
      isConfirmed: true,
      needsReview: false,
      transactionDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'android_sms',
      sourceSmsPreview: 'secret sms body',
    } satisfies Transaction;
    snap.transactions = [tx];
    snap.unknownSms = [
      {
        id: 'u1',
        userId: snap.profile.id,
        sender: 'bank',
        receivedAt: new Date().toISOString(),
        patternHash: 'abc',
        parserVersion: '1',
        failureReason: 'unknown',
      } satisfies UnknownSmsRecord,
    ];
    const payload = buildSanitizedBackup(snap);
    expect(payload.transactions[0]).not.toHaveProperty('sourceSmsPreview');
    expect(payload).not.toHaveProperty('unknownSms');
    expect(payload.format).toBe('mali-backup');
  });

  it('validates backup json', () => {
    const snap = buildSanitizedBackup(emptySnapshot());
    const raw = JSON.stringify(snap);
    expect(validateBackupJson(raw).ok).toBe(true);
    expect(validateBackupJson('not json').ok).toBe(false);
  });
});
