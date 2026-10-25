import { preprocessSms } from '../normalizer/preprocess';
import { parseGenericBankSms } from '../banks/generic/parser';
import { detectBank } from '../detectors/bankDetector';
import { runSmsPipeline } from '../pipeline/run';
import { melliParser } from '../banks/melli/parser';
import { mellatParser } from '../banks/mellat/parser';

describe('SMS preprocessor', () => {
  it('converts Persian digits and commas', () => {
    const n = preprocessSms({
      sender: '9909',
      body: 'مبلغ ۱٬۲۵۰٬۰۰۰ ریال',
      receivedAt: '2026-08-25T10:00:00.000Z',
    });
    expect(n.body).toContain('1250000');
  });

  it('normalizes Arabic yeh/kaf', () => {
    const n = preprocessSms({
      sender: 'x',
      body: 'بانك ملي',
      receivedAt: '2026-08-25T10:00:00.000Z',
    });
    expect(n.body).toContain('بانک');
    expect(n.body).toContain('ملی');
  });
});

describe('generic keyword parser', () => {
  it('parses a synthetic withdrawal with Rial amount', () => {
    const n = preprocessSms({
      sender: 'test',
      body: 'برداشت از حساب مبلغ 1250000 ریال مانده 2000000',
      receivedAt: '2026-08-25T10:00:00.000Z',
    });
    const parsed = parseGenericBankSms(n);
    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe('withdrawal');
    expect(parsed?.amount).toBe(1250000);
    expect(parsed?.currency).toBe('IRR');
  });

  it('parses amount next to rial without مبلغ', () => {
    const n = preprocessSms({
      sender: 'test',
      body: 'برداشت 2500000 ریال',
      receivedAt: '2026-08-25T10:00:00.000Z',
    });
    expect(parseGenericBankSms(n)?.amount).toBe(2500000);
  });

  it('converts Toman to internal Rial', () => {
    const n = preprocessSms({
      sender: 'test',
      body: 'واریز مبلغ 125000 تومان',
      receivedAt: '2026-08-25T10:00:00.000Z',
    });
    const parsed = parseGenericBankSms(n);
    expect(parsed?.type).toBe('deposit');
    expect(parsed?.amount).toBe(1_250_000);
  });
});

describe('bank detector', () => {
  it('does not silently guess on unknown sender', () => {
    const n = preprocessSms({
      sender: '12345',
      body: 'hello',
      receivedAt: '2026-08-25T10:00:00.000Z',
    });
    const d = detectBank(n);
    expect(d.matched).toBe(false);
    expect(d.bankId).toBeUndefined();
  });

  it('matches Mellat from known sender', () => {
    const n = preprocessSms({
      sender: '9909',
      body: 'برداشت مبلغ 10000 ریال',
      receivedAt: '2026-08-25T10:00:00.000Z',
    });
    expect(detectBank(n).bankId).toBe('mellat');
  });
});

describe('bank-specific parsers', () => {
  it('parses Bank Mellat deposit and purchase from verified samples', () => {
    expect(mellatParser.status).toBe('ok');
    const deposit = preprocessSms({
      sender: '9909',
      body: 'بانک ملت\nواریز مبلغ 5,000,000 ریال\nمانده 120,000,000 ریال\nکارت ****1234',
      receivedAt: '2026-08-25T10:00:00.000Z',
    });
    expect(mellatParser.canParse(deposit).matched).toBe(true);
    const d = mellatParser.parse(deposit);
    expect(d?.type).toBe('deposit');
    expect(d?.amount).toBe(5_000_000);
    expect(d?.balance).toBe(120_000_000);
    expect(d?.cardLast4).toBe('1234');

    const purchase = preprocessSms({
      sender: '9909',
      body: 'بانک ملت\nخرید از دیجی کالا\nمبلغ 2,500,000 ریال کسر شد\nمانده 98,000,000\nکارت ****5678',
      receivedAt: '2026-08-25T11:00:00.000Z',
    });
    const p = mellatParser.parse(purchase);
    expect(p?.type).toBe('purchase');
    expect(p?.amount).toBe(2_500_000);
    expect(p?.merchant).toContain('دیجی');
  });

  it('parses Bank Melli transfer credit from a real fixture', () => {
    const n = preprocessSms({
      sender: '9830009417',
      body: 'بانك ملي ايران\nانتقال:1,500,000+\nحساب:61008\nمانده:117,896,079\n0603-19:36',
      receivedAt: '2026-08-25T16:00:00.000Z',
    });
    expect(melliParser.canParse(n).matched).toBe(true);
    const parsed = melliParser.parse(n);
    expect(parsed?.type).toBe('deposit');
    expect(parsed?.amount).toBe(1_500_000);
    expect(parsed?.currency).toBe('IRR');
    expect(parsed?.balance).toBe(117_896_079);
    expect(parsed?.cardLast4).toBe('1008');
    expect(parsed?.description).toBe('انتقال');
  });

  it('parses Bank Melli Pol credit from a real fixture', () => {
    const n = preprocessSms({
      sender: '9830009417',
      body: '...حواله پل:2,500,000+\nحساب:61008\nمانده:105,596,079\n\n0603-11:28',
      receivedAt: '2026-08-25T08:00:00.000Z',
    });
    const parsed = melliParser.parse(n);
    expect(parsed?.type).toBe('deposit');
    expect(parsed?.amount).toBe(2_500_000);
    expect(parsed?.description).toBe('حواله پل');
  });

  it('parses Bank Melli internet purchase debit from a real fixture', () => {
    const n = preprocessSms({
      sender: '9830009417',
      body: '...خريداينترنتي:10,890,000-\nحساب:61008\nمانده:118,991,479\n0603-10:15',
      receivedAt: '2026-08-25T07:00:00.000Z',
    });
    const parsed = melliParser.parse(n);
    expect(parsed?.type).toBe('purchase');
    expect(parsed?.amount).toBe(10_890_000);
    expect(parsed?.merchant).toBe('خریداینترنتی');
    expect(parsed?.description).toBe('خریداینترنتی');
  });

  it('runs the pipeline as income/expense not internal transfer', () => {
    const result = runSmsPipeline({
      userId: 'u1',
      accountId: 'a1',
      existing: [],
      raw: {
        sender: '9830009417',
        body: 'بانك ملي ايران\nانتقال:1,500,000+\nحساب:61008\nمانده:117,896,079\n0603-19:36',
        receivedAt: '2026-08-25T16:00:00.000Z',
      },
    });
    expect(result.status).toBe('created');
    expect(result.transaction?.direction).toBe('in');
    expect(result.transaction?.type).toBe('deposit');
    expect(result.telemetry.bankId).toBe('melli');
  });
});

describe('pipeline', () => {
  it('returns unknown for malformed SMS', () => {
    const result = runSmsPipeline({
      userId: 'u1',
      accountId: 'a1',
      existing: [],
      raw: { sender: 'x', body: 'سلام', receivedAt: '2026-08-25T10:00:00.000Z' },
    });
    expect(result.status).toBe('unknown');
    expect(result.unknown?.failureReason).toBe('bank_not_detected');
  });

  it('detects duplicate fingerprints', () => {
    const raw = {
      sender: '9909',
      body: 'برداشت از حساب مبلغ 1250000 ریال',
      receivedAt: '2026-08-25T10:00:00.000Z',
    };
    const first = runSmsPipeline({ userId: 'u1', accountId: 'a1', existing: [], raw });
    expect(first.transaction).toBeTruthy();
    const second = runSmsPipeline({
      userId: 'u1',
      accountId: 'a1',
      existing: [
        {
          ...first.transaction!,
          id: '1',
          createdAt: raw.receivedAt,
          updatedAt: raw.receivedAt,
        },
      ],
      raw,
    });
    expect(second.status).toBe('duplicate');
  });
});
