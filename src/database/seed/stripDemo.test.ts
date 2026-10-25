import { stripSeededDemo } from './stripDemo';
import { emptySnapshot } from '../schema/snapshot';
import type { FinancialAccount, Transaction } from '../../types/finance';

const account = (id: string): FinancialAccount =>
  ({ id, userId: 'u', kind: 'cash', name: id, balanceRial: 0, transactionCount: 0, createdAt: '', updatedAt: '' }) as FinancialAccount;
const tx = (id: string, accountId: string, fingerprint: string): Transaction =>
  ({ id, accountId, fingerprint, transactionDate: '2026-10-26T12:00:00' }) as Transaction;

describe('stripSeededDemo', () => {
  it('removes seeded demo transactions and their unused demo accounts', () => {
    const out = stripSeededDemo({
      ...emptySnapshot(),
      accounts: [account('acc_mellat'), account('acc_mine')],
      transactions: [tx('tx_1', 'acc_mellat', 'demo_1'), tx('tx_x', 'acc_mine', 'fp')],
    });
    expect(out.transactions.map(t => t.id)).toEqual(['tx_x']);
    expect(out.accounts.map(a => a.id)).toEqual(['acc_mine']);
  });

  it('keeps a user entry that was filed under a demo account id', () => {
    const out = stripSeededDemo({
      ...emptySnapshot(),
      accounts: [],
      transactions: [tx('tx_1761473000000', 'acc_cash', 'user-fp')],
    });
    expect(out.transactions).toHaveLength(1);
  });
});
