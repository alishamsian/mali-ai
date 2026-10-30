import type { Transaction, TransferLink } from '../../types/finance';

const WINDOW_HOURS = 36;

export function detectTransfers(transactions: Transaction[], userId: string): TransferLink[] {
  const candidate = (t: Transaction) => t.type === 'transfer' || t.categoryId === 'transfer' || Boolean(t.transferId);
  const outs = transactions.filter(t => t.direction === 'out' && candidate(t));
  // Bucket incoming by amount (order preserved): an out can only pair with an equal amount,
  // so this finds the same first match as scanning every incoming transaction, without O(n²).
  const insByAmount = new Map<number, Array<{ tx: Transaction; at: number }>>();
  for (const t of transactions) {
    if (t.direction !== 'in' || !candidate(t)) {
      continue;
    }
    const bucket = insByAmount.get(t.amountRial);
    const entry = { tx: t, at: Date.parse(t.transactionDate) };
    if (bucket) {
      bucket.push(entry);
    } else {
      insByAmount.set(t.amountRial, [entry]);
    }
  }
  const links: TransferLink[] = [];
  const usedIn = new Set<string>();

  for (const out of outs) {
    const outAt = Date.parse(out.transactionDate);
    const match = insByAmount.get(out.amountRial)?.find(({ tx: i, at }) => {
      if (usedIn.has(i.id) || i.accountId === out.accountId) {
        return false;
      }
      return Math.abs(at - outAt) / 36e5 <= WINDOW_HOURS;
    })?.tx;
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

export function applyTransferLinks(
  transactions: Transaction[],
  links: TransferLink[],
): Transaction[] {
  const byId = new Map(
    links.flatMap(
      l =>
        [
          [l.outboundTransactionId, l.id],
          [l.inboundTransactionId, l.id],
        ] as const,
    ),
  );
  return transactions.map(tx => {
    const transferId = byId.get(tx.id);
    if (tx.transferId === transferId) {
      return tx;
    }
    // Preserve the actual money direction, type and category for undo/edit/reconciliation.
    return { ...tx, transferId };
  });
}
