import { emptySnapshot } from '../../../database/schema/snapshot';
import { ingestIncomingSms, recomputeAccountBalancesFromSms } from '../ingest';
import {
  addVerifiedSender,
  getVerifiedSenderStrings,
  isVerifiedSender,
  migrateBankConnections,
  removeVerifiedSender,
} from '../senders/verified';
import { normalizeSmsSender } from '../senders/normalize';
import { isNonTransactionalSms, isSuitableForSenderVerification } from '../senders/classify';
import { runIncrementalSmsSync, __resetIncrementalSyncLockForTests } from '../import/incrementalSync';
import { collectBankSenderSms } from '../import/bankSenderScan';
import type { NormalizedInboxSms } from '../native/SmsModule';
import type { UserSettings } from '../../../types/finance';

function mellatDeposit(amount: number, balance: number): string {
  return `بانک ملت\nواریز مبلغ ${amount.toLocaleString('en-US')} ریال\nمانده ${balance.toLocaleString('en-US')}`;
}

function withVerifiedMellat(settings: UserSettings, sender = '9909'): UserSettings {
  const connections = addVerifiedSender([], 'mellat', sender, 'user_selected_sms');
  return {
    ...settings,
    smsProcessingEnabled: true,
    bankConnections: connections,
    selectedBankIds: ['mellat'],
  };
}

describe('verified sender architecture', () => {
  beforeEach(() => {
    __resetIncrementalSyncLockForTests();
  });

  test('normalizeSmsSender strips + and spaces', () => {
    expect(normalizeSmsSender(' +983000 ')).toBe('983000');
    expect(normalizeSmsSender('۹۹۰۹')).toBe('9909');
  });

  test('user confirms 983000 for melli → only that sender is verified', () => {
    let connections = addVerifiedSender([], 'melli', '983000', 'user_selected_sms');
    expect(connections[0]?.verifiedSenders.map(s => s.sender)).toEqual(['983000']);
    connections = addVerifiedSender(connections, 'melli', '983000', 'user_selected_sms');
    expect(connections[0]?.verifiedSenders.length).toBe(1);
    connections = addVerifiedSender(connections, 'melli', '9830009417', 'user_selected_sms');
    expect(connections[0]?.verifiedSenders.map(s => s.sender).sort()).toEqual([
      '983000',
      '9830009417',
    ]);
  });

  test('SMS from verified sender reaches parser; other sender ignored', () => {
    let snapshot = emptySnapshot('u1');
    snapshot.settings = withVerifiedMellat(snapshot.settings, '9909');

    const ok = ingestIncomingSms(
      snapshot,
      {
        sender: '9909',
        body: mellatDeposit(250_000, 1_000_000),
        receivedAt: new Date().toISOString(),
        sourceSmsId: '1',
      },
      { mode: 'incremental' },
    );
    expect(['created', 'review', 'pending']).toContain(ok.kind);

    const blocked = ingestIncomingSms(
      snapshot,
      {
        sender: '983000',
        body: 'بانك ملي ايران\nانتقال:1,500,000+\nحساب:61008\nمانده:117,896,079',
        receivedAt: new Date().toISOString(),
        sourceSmsId: '2',
      },
      { mode: 'incremental' },
    );
    expect(blocked.kind).toBe('ignored');
  });

  test('OTP from verified sender is non_transactional', () => {
    const snapshot = emptySnapshot('u1');
    snapshot.settings = withVerifiedMellat(snapshot.settings, '9909');
    const result = ingestIncomingSms(
      snapshot,
      {
        sender: '9909',
        body: 'رمز پویا: 483921',
        receivedAt: new Date().toISOString(),
        sourceSmsId: 'otp-1',
      },
      { mode: 'live' },
    );
    expect(result.kind).toBe('non_transactional');
    expect(isNonTransactionalSms('رمز پویا: 483921')).toBe(true);
  });

  test('unknown transactional format from verified sender → unknownSms', () => {
    const snapshot = emptySnapshot('u1');
    snapshot.settings = withVerifiedMellat(snapshot.settings, '9909');
    const result = ingestIncomingSms(
      snapshot,
      {
        sender: '9909',
        body: 'بانک ملت\nواریز مبلغ نامشخص بدون عدد معتبر برای پارسر',
        receivedAt: new Date().toISOString(),
        sourceSmsId: 'unk-1',
      },
      { mode: 'incremental' },
    );
    expect(['unknown', 'non_transactional']).toContain(result.kind);
  });

  test('removing sender prevents future processing', () => {
    let connections = addVerifiedSender([], 'mellat', '9909', 'user_selected_sms');
    connections = removeVerifiedSender(connections, 'mellat', '9909');
    const settings = {
      ...emptySnapshot().settings,
      bankConnections: connections,
      smsProcessingEnabled: true,
    };
    expect(isVerifiedSender(settings, '9909')).toBe(false);
  });

  test('legacy migration from selectedBankIds', () => {
    const migrated = migrateBankConnections({
      ...emptySnapshot().settings,
      selectedBankIds: ['melli'],
      bankConnections: [],
    });
    expect(migrated.bankConnections?.length).toBe(1);
    expect(migrated.bankConnections?.[0]?.bankId).toBe('melli');
    expect(migrated.bankConnections?.[0]?.verifiedSenders.some(s => s.method === 'legacy_system')).toBe(
      true,
    );
    expect(getVerifiedSenderStrings(migrated).length).toBeGreaterThan(0);
  });

  test('unsuitable OTP cannot verify sender in picker gate', () => {
    expect(isSuitableForSenderVerification('رمز پویا 123456')).toBe(false);
    expect(isSuitableForSenderVerification(mellatDeposit(1000, 2000))).toBe(true);
  });

  test('incremental sync only uses provided verified senders', async () => {
    const now = Date.now();
    const smsList: NormalizedInboxSms[] = [
      {
        sourceSmsId: '1',
        sender: '9909',
        body: mellatDeposit(1000, 2000),
        receivedAt: new Date(now - 1000).toISOString(),
      },
    ];
    const result = await runIncrementalSmsSync({
      checkpoint: {},
      smsProcessingEnabled: true,
      nowMs: now,
      verifiedSenders: ['9909'],
      hasPermission: async () => true,
      collectRows: async () => ({ rows: smsList, perSenderCounts: { '9909': 1 } }),
      ingest: () => ({ kind: 'created' }),
    });
    expect(result.scannedCount).toBe(1);

    __resetIncrementalSyncLockForTests();
    const empty = await runIncrementalSmsSync({
      checkpoint: {},
      smsProcessingEnabled: true,
      nowMs: now,
      verifiedSenders: [],
      hasPermission: async () => true,
      ingest: () => ({ kind: 'created' }),
    });
    expect(empty.scannedCount).toBe(0);
    expect(empty.status).toBe('completed');
  });

  test('two identical amounts different SMS ids stay separate with verified sender', () => {
    let snapshot = emptySnapshot('u1');
    snapshot.settings = withVerifiedMellat(snapshot.settings, '9909');
    const body = mellatDeposit(100_000_000, 300_000_000);
    const a = ingestIncomingSms(
      snapshot,
      { sender: '9909', body, receivedAt: '2026-08-27T10:00:00.000Z', sourceSmsId: '5001' },
      { mode: 'incremental' },
    );
    snapshot = {
      ...snapshot,
      accounts: a.account ? [...snapshot.accounts, a.account] : snapshot.accounts,
      transactions: a.transaction ? [a.transaction, ...snapshot.transactions] : snapshot.transactions,
    };
    const b = ingestIncomingSms(
      snapshot,
      {
        sender: '9909',
        body: mellatDeposit(100_000_000, 400_000_000),
        receivedAt: '2026-08-27T10:00:01.000Z',
        sourceSmsId: '5002',
      },
      { mode: 'incremental' },
    );
    expect(a.kind).not.toBe('duplicate');
    expect(b.kind).not.toBe('duplicate');
    snapshot = {
      ...snapshot,
      transactions: b.transaction ? [b.transaction, ...snapshot.transactions] : snapshot.transactions,
    };
    snapshot = {
      ...snapshot,
      accounts: recomputeAccountBalancesFromSms(snapshot.accounts, snapshot.transactions),
    };
    expect(snapshot.accounts.find(x => x.bankId === 'mellat')?.balanceRial).toBe(400_000_000);
  });

  test('collectBankSenderSms requires explicit senders list', async () => {
    const { rows } = await collectBankSenderSms({
      minDateMs: 0,
      maxDateMs: Date.now(),
      senders: [],
    });
    expect(rows).toEqual([]);
  });
});
