import { BACKUP_FORMAT, buildSanitizedBackup, resolveBackupInput } from './backup';
import { encryptBackupPayload } from './backupCrypto';
import { emptySnapshot } from '../../database/schema/snapshot';
import type { FinancialAccount, Transaction } from '../../types/finance';

const now = '2026-10-20T10:00:00.000Z';

const tx = (id: string, overrides: Record<string, unknown> = {}) =>
  ({
    id,
    userId: 'u',
    accountId: 'acc_1',
    type: 'purchase',
    direction: 'out',
    amountRial: 1_000,
    currency: 'IRR',
    categoryId: 'food',
    transactionDate: now,
    source: 'manual',
    fingerprint: `fp-${id}`,
    confidence: 1,
    isConfirmed: true,
    needsReview: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }) as Transaction;

const account = {
  id: 'acc_1',
  userId: 'u',
  kind: 'bank',
  name: 'ملت',
  balanceRial: 5_000,
  transactionCount: 1,
  createdAt: now,
  updatedAt: now,
} as FinancialAccount;

function backupJson(transactions: Transaction[], extra: Record<string, unknown> = {}) {
  const snap = emptySnapshot();
  snap.accounts = [account];
  snap.transactions = transactions;
  return JSON.stringify({ ...buildSanitizedBackup(snap), ...extra });
}

describe('backup content validation', () => {
  it('accepts a well-formed backup', () => {
    expect(resolveBackupInput(backupJson([tx('a'), tx('b')])).ok).toBe(true);
  });

  it.each([
    ['a missing id', { id: '' }],
    ['a non-numeric amount', { amountRial: '1000' }],
    ['a negative amount', { amountRial: -5 }],
    ['an unknown direction', { direction: 'sideways' }],
    ['an unparseable date', { transactionDate: 'yesterday' }],
    ['no account', { accountId: undefined }],
  ])('rejects a transaction with %s', (_label, bad) => {
    expect(resolveBackupInput(backupJson([tx('a'), tx('b', bad)]))).toEqual({
      ok: false,
      error: 'schema',
    });
  });

  it('rejects duplicate transaction ids', () => {
    expect(resolveBackupInput(backupJson([tx('a'), tx('a')])).ok).toBe(false);
  });

  it('rejects an optional section that is not an array', () => {
    expect(resolveBackupInput(backupJson([tx('a')], { budgets: { oops: true } })).ok).toBe(false);
  });

  it('rejects a malformed account', () => {
    const json = JSON.parse(backupJson([tx('a')]));
    json.accounts = [{ ...account, balanceRial: null }];
    expect(resolveBackupInput(JSON.stringify(json)).ok).toBe(false);
  });

  it('still accepts a legacy v1 export without the format wrapper', () => {
    const legacy = { profile: emptySnapshot().profile, transactions: [tx('a')], accounts: [account] };
    expect(resolveBackupInput(JSON.stringify(legacy)).ok).toBe(true);
  });

  it('applies the same checks to encrypted backups', () => {
    const payload = JSON.parse(backupJson([tx('a', { amountRial: Number.NaN })]));
    payload.format = BACKUP_FORMAT;
    payload.transactions[0].amountRial = 'NaN';
    const encrypted = JSON.stringify(encryptBackupPayload(payload, 'correct horse'));
    expect(resolveBackupInput(encrypted, 'correct horse')).toEqual({ ok: false, error: 'schema' });
  });
});
