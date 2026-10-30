import { detectTransfers } from './detect';
import type { Transaction, TransferLink } from '../../types/finance';

/** The original O(n²) scan, kept here as the reference the indexed version must match. */
function reference(transactions: Transaction[], userId: string): TransferLink[] {
  const candidate = (t: Transaction) => t.type === 'transfer' || t.categoryId === 'transfer' || Boolean(t.transferId);
  const outs = transactions.filter(t => t.direction === 'out' && candidate(t));
  const ins = transactions.filter(t => t.direction === 'in' && candidate(t));
  const links: TransferLink[] = [];
  const usedIn = new Set<string>();
  for (const out of outs) {
    const match = ins.find(i => {
      if (usedIn.has(i.id) || i.accountId === out.accountId || i.amountRial !== out.amountRial) {
        return false;
      }
      return Math.abs(Date.parse(i.transactionDate) - Date.parse(out.transactionDate)) / 36e5 <= 36;
    });
    if (!match) {
      continue;
    }
    usedIn.add(match.id);
    links.push({
      id: `tr_${out.id}_${match.id}`,
      userId,
      sourceAccountId: out.accountId,
      destinationAccountId: match.accountId,
      amountRial: out.amountRial,
      date: out.transactionDate,
      outboundTransactionId: out.id,
      inboundTransactionId: match.id,
    });
  }
  return links;
}

function rng(seed: number) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
}

describe('detectTransfers', () => {
  it('matches the reference scan on random ledgers', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const r = rng(seed);
      const txs = Array.from({ length: 300 }, (_, i) => {
        const at = Date.UTC(2026, 9, 1) + Math.floor(r() * 10 * 86400000);
        return {
          id: `t${i}`,
          accountId: `a${Math.floor(r() * 3)}`,
          type: r() < 0.5 ? 'transfer' : 'purchase',
          direction: r() < 0.5 ? 'out' : 'in',
          amountRial: [100, 200, 300, 400][Math.floor(r() * 4)],
          transactionDate: new Date(at).toISOString(),
          transferId: r() < 0.05 ? 'x' : undefined,
        } as Transaction;
      });
      expect(detectTransfers(txs, 'u')).toEqual(reference(txs, 'u'));
    }
  });
});
