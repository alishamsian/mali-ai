import { LocalFinanceDb } from './localDb';
import { MemoryStorage } from './memory';
import { emptySnapshot } from '../schema/snapshot';
import type { Transaction } from '../../types/finance';

function manyTransactions(n: number): Transaction[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `tx_${i}`,
    userId: 'u',
    accountId: 'acc',
    type: 'purchase',
    direction: 'out',
    amountRial: 1_000 + i,
    currency: 'IRR',
    merchant: `merchant ${i % 300}`,
    categoryId: 'food',
    transactionDate: new Date(1_760_000_000_000 + i * 60_000).toISOString(),
    source: 'android_sms',
    fingerprint: `fp_${i}`,
    confidence: 0.9,
    isConfirmed: true,
    needsReview: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }));
}

describe('LocalFinanceDb.save', () => {
  it('writes exactly what JSON.stringify would, including after partial changes', () => {
    const storage = new MemoryStorage();
    const db = new LocalFinanceDb(storage);
    const first = { ...emptySnapshot(), transactions: manyTransactions(5) };
    db.save(first);
    expect(storage.get('mali.finance.v1')).toBe(JSON.stringify(first));

    const second = { ...first, settings: { ...first.settings, hideBalances: true } };
    db.save(second);
    expect(storage.get('mali.finance.v1')).toBe(JSON.stringify(second));

    const third = { ...second, transactions: second.transactions.slice(1) };
    db.save(third);
    expect(storage.get('mali.finance.v1')).toBe(JSON.stringify(third));
    expect(db.load().transactions).toHaveLength(4);
  });

  it('omits undefined sections the way JSON.stringify does', () => {
    const storage = new MemoryStorage();
    const snap = { ...emptySnapshot(), netWorthHistory: undefined } as never;
    new LocalFinanceDb(storage).save(snap);
    expect(storage.get('mali.finance.v1')).toBe(JSON.stringify(snap));
  });

  it('does not re-serialize unchanged transactions on a settings-only save', () => {
    const db = new LocalFinanceDb(new MemoryStorage());
    const base = { ...emptySnapshot(), transactions: manyTransactions(20_000) };
    db.save(base);

    const spy = jest.spyOn(JSON, 'stringify');
    db.save({ ...base, settings: { ...base.settings, hideBalances: true } });
    const serialized = spy.mock.calls.map(([value]) => value);
    spy.mockRestore();

    expect(serialized).not.toContain(base.transactions);
    expect(serialized).not.toContain(base);
  });
});
