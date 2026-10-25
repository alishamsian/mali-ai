import { emptySnapshot } from '../src/database/schema/snapshot';
import { ingestIncomingSms } from '../src/features/sms/ingest';
import { addVerifiedSender } from '../src/features/sms/senders/verified';
import { answerFinanceQuestion } from '../src/engine/insights/assistant';
import { fa } from '../src/i18n/fa';
import { stripSeededDemo } from '../src/database/seed/stripDemo';
import { DEMO_ACCOUNTS, DEMO_TRANSACTIONS } from '../src/database/seed/demo';
import { LocalFinanceDb } from '../src/database/drivers/localDb';
import { MemoryStorage } from '../src/database/drivers/memory';

describe('local persistence', () => {
  it('round-trips a snapshot', () => {
    const db = new LocalFinanceDb(new MemoryStorage());
    expect(db.hasSnapshot()).toBe(false);
    const snap = emptySnapshot();
    snap.profile.displayName = 'تست';
    db.save(snap);
    expect(db.hasSnapshot()).toBe(true);
    expect(db.load().profile.displayName).toBe('تست');
  });
});

describe('sms ingest', () => {
  it('ignores SMS until processing is enabled', () => {
    const snapshot = emptySnapshot();
    const result = ingestIncomingSms(snapshot, {
      sender: '9909',
      body: 'برداشت از حساب مبلغ 1250000 ریال',
    });
    expect(result.kind).toBe('ignored');
  });

  it('creates a review transaction from a keyword SMS', () => {
    const snapshot = emptySnapshot();
    snapshot.settings.smsProcessingEnabled = true;
    snapshot.settings.bankConnections = addVerifiedSender([], 'mellat', '9909', 'user_selected_sms');
    const result = ingestIncomingSms(snapshot, {
      sender: '9909',
      body: 'برداشت از حساب مبلغ 1250000 ریال',
    });
    expect(result.kind === 'review' || result.kind === 'created' || result.kind === 'pending').toBe(true);
    expect(result.transaction?.amountRial).toBe(1250000);
    expect(result.account?.bankId).toBe('mellat');
  });

  it('verified sender processes generic withdrawal SMS', () => {
    const snapshot = emptySnapshot();
    snapshot.settings.smsProcessingEnabled = true;
    snapshot.settings.bankConnections = addVerifiedSender([], 'saman', '50001', 'user_selected_sms');
    const result = ingestIncomingSms(snapshot, {
      sender: '50001',
      body: 'برداشت از حساب مبلغ 1250000 ریال',
    });
    expect(['review', 'created', 'pending']).toContain(result.kind);
    expect(result.transaction?.amountRial).toBe(1250000);
    expect(result.account?.bankId).toBe('saman');
  });

  it('creates a Bank Melli account from a real fixture', () => {
    const snapshot = emptySnapshot();
    snapshot.settings.smsProcessingEnabled = true;
    snapshot.settings.bankConnections = addVerifiedSender(
      [],
      'melli',
      '9830009417',
      'user_selected_sms',
    );
    const result = ingestIncomingSms(snapshot, {
      sender: '9830009417',
      body: 'بانك ملي ايران\nانتقال:1,500,000+\nحساب:61008\nمانده:117,896,079\n0603-19:36',
    });
    expect(result.kind).toBe('created');
    expect(result.account?.id).toBe('acc_sms_melli_1008');
    expect(result.transaction?.balanceAfterRial).toBe(117_896_079);
  });
});

describe('assistant', () => {
  it('answers from real monthly totals only', () => {
    const snapshot = emptySnapshot();
    snapshot.transactions = [
      {
        id: '1',
        userId: 'local-user',
        accountId: 'a',
        type: 'purchase',
        direction: 'out',
        amountRial: 100_000,
        currency: 'IRR',
        categoryId: 'food',
        transactionDate: new Date().toISOString(),
        source: 'manual',
        fingerprint: 'x',
        confidence: 1,
        isConfirmed: true,
        needsReview: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    const a = answerFinanceQuestion('این ماه چقدر خرج کردم؟', snapshot, fa.categories);
    expect(a).toContain('هزینه');
  });
});

describe('demo strip', () => {
  it('removes seeded demo accounts and transactions', () => {
    const snapshot = emptySnapshot();
    snapshot.profile.displayName = 'علی';
    snapshot.accounts = DEMO_ACCOUNTS;
    snapshot.transactions = DEMO_TRANSACTIONS;
    const cleaned = stripSeededDemo(snapshot);
    expect(cleaned.accounts).toHaveLength(0);
    expect(cleaned.transactions).toHaveLength(0);
    expect(cleaned.profile.displayName).toBe('');
  });
});
