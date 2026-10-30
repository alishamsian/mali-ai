import { runSmsPipeline } from '../pipeline/run';

const run = (body: string) =>
  runSmsPipeline({
    userId: 'u',
    accountId: 'a',
    existing: [],
    // A bank without its own parser, so the generic one (and this rule) applies.
    forcedBankId: 'sepah',
    raw: { sender: 'BankX', body, receivedAt: '2026-10-01T10:00:00Z' } as never,
  }).transaction;

describe('generic transfer direction', () => {
  it('reads the amount sign: + is money in, − is money out', () => {
    const t = run('انتقال وجه 2,500,000+ مانده 9,000,000 0805-12:10');
    expect([t?.type, t?.direction]).toEqual(['transfer', 'in']);
    expect(run('انتقال وجه 2,500,000- مانده 6,500,000 0805-12:10')?.direction).toBe('out');
  });

  it('does not take a date dash for a minus sign', () => {
    expect(run('واریز انتقال 300,000 به حساب شما 0805-12:10')?.direction).toBe('in');
  });
});
