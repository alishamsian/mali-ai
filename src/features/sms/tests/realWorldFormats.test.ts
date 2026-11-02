import { emptySnapshot } from '../../../database/schema/snapshot';
import { ingestIncomingSms } from '../ingest';
import { addVerifiedSender } from '../senders/verified';

const at = '2026-11-01T10:00:00Z';
let conns = addVerifiedSender([], 'melli', '9830009417', 'user_selected_sms');
for (const [bank, sender] of [
  ['mellat', '98700717'],
  ['saman', '9830009007'],
  ['pasargad', '9830009040'],
  ['tejarat', '983000270'],
  ['blu', 'blu'],
] as const) {
  conns = addVerifiedSender(conns, bank, sender, 'user_selected_sms');
}

function ingest(sender: string, body: string) {
  const snapshot = emptySnapshot('u');
  snapshot.settings.smsProcessingEnabled = true;
  snapshot.settings.bankConnections = conns;
  const result = ingestIncomingSms(
    snapshot,
    { sender, body, receivedAt: at, sourceSmsId: body },
    { mode: 'live' },
  );
  const tx = result.transaction;
  return { kind: result.kind, tx };
}

test('Persian digits and Arabic letters are read like ASCII and Persian', () => {
  const r = ingest(
    '9830009417',
    'بانک ملی ایران\nبرداشت:۱۲۰,۰۰۰-\nحساب:۶۱۰۰۸\nمانده:۵,۰۰۰,۰۰۰\n۰۸۱۰-۱۲:۲۰',
  );
  expect(r.kind).toBe('created');
  expect(r.tx).toMatchObject({
    amountRial: 120_000,
    direction: 'out',
    balanceAfterRial: 5_000_000,
  });
  expect(
    ingest('blu', 'بلو\nواریز ۲,۰۰۰,۰۰۰ تومان به حساب شما\nموجودی: ۵,۴۰۰,۰۰۰ تومان').tx,
  ).toMatchObject({
    amountRial: 20_000_000,
    direction: 'in',
  });
});

test('bank ads and OTPs with amounts never become transactions', () => {
  expect(ingest('98700717', 'بانک ملت: با همراه بانک ملت تا 50,000,000 ریال وام بگیرید').kind).toBe(
    'non_transactional',
  );
  expect(ingest('98700717', 'بانک ملت\nرمز پویا: 123456\nمبلغ:450,000').kind).toBe(
    'non_transactional',
  );
});

test('a refund is a refund, and an overdrawn balance keeps its sign', () => {
  expect(
    ingest(
      '9830009417',
      'بانك ملي ايران\nبرگشت وجه:85,000+\nحساب:61008\nمانده:3,000,000\n0810-12:40',
    ).tx?.type,
  ).toBe('refund');
  expect(
    ingest('9830009417', 'بانك ملي ايران\nبرداشت:300,000-\nحساب:61008\nمانده:-50,000\n0810-12:20')
      .tx?.balanceAfterRial,
  ).toBe(-50_000);
});

test('clear messages from banks without a dedicated parser are recorded, not queued', () => {
  for (const [sender, body] of [
    [
      '98700717',
      'بانک ملت\nخرید\nکارت6104*1234\nمبلغ:450,000ریال\nمانده:12,300,000\n1405/08/10\n13:22',
    ],
    [
      '9830009007',
      'سامان\nبرداشت از حساب 801-1234567-1\nمبلغ 1,200,000 ریال\nمانده 3,450,000\n1405/08/10 14:05',
    ],
    [
      '9830009040',
      'پاسارگاد\nبرداشت:1,000,000\nازحساب:207.8000.1234567.1\nموجودی:4,500,000\n05/08/10_14:25',
    ],
    [
      '983000270',
      'تجارت\nمبلغ 2,500,000 ريال از حساب 1234 برداشت شد\nمانده: 8,750,000\n1405/08/10',
    ],
  ]) {
    expect(ingest(sender, body).kind).toBe('created');
  }
  // A transfer's direction depends on wording, so without a sign it still asks.
  expect(
    ingest('98700717', 'بانک ملت\nانتقال از کارت\n6104****1234\nمبلغ:1,000,000\nمانده:5,000,000')
      .kind,
  ).toBe('review');
});
