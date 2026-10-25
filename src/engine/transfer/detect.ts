import type { Transaction, TransferLink } from '../../types/finance';

const WINDOW_HOURS = 36;

export function detectTransfers(transactions: Transaction[], userId: string): TransferLink[] {
  const outs = transactions.filter(t => t.direction === 'out' && !t.transferId);
  const ins = transactions.filter(t => t.direction === 'in' && !t.transferId);
  const links: TransferLink[] = [];
  const usedIn = new Set<string>();

  for (const out of outs) {
    const match = ins.find(i => {
      if (usedIn.has(i.id) || i.accountId === out.accountId) {
        return false;
      }
      if (i.amountRial !== out.amountRial) {
        return false;
      }
      const dh = Math.abs(Date.parse(i.transactionDate) - Date.parse(out.transactionDate)) / 36e5;
      return dh <= WINDOW_HOURS;
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

export function applyTransferLinks(transactions: Transaction[], links: TransferLink[]): Transaction[] {
  const byId = new Map(links.flatMap(l => [
    [l.outboundTransactionId, l.id],
    [l.inboundTransactionId, l.id],
  ] as const));
  return transactions.map(tx => {
    const transferId = byId.get(tx.id);
    if (!transferId) {
      return tx;
    }
    return {
      ...tx,
      type: 'transfer',
      direction: 'internal' as const,
      categoryId: 'transfer',
      transferId,
    };
  });
}
