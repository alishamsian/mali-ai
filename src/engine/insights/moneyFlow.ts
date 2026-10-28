import type { CategoryId, Transaction } from '../../types/finance';
import { isExpenseLike, isIncomeLike } from './analytics';

export type FlowNodeId = CategoryId | 'other' | 'savings' | 'balance';

export interface FlowNode {
  id: FlowNodeId;
  rial: number;
}

export interface MoneyFlow {
  /** Where the money came from: income categories, plus "balance" when spending exceeded income. */
  sources: FlowNode[];
  /** Where it went: top expense categories, "other", and "savings" when income exceeded spending. */
  sinks: FlowNode[];
  totalRial: number;
}

function totals(txs: Transaction[]): FlowNode[] {
  const map = new Map<CategoryId, number>();
  for (const tx of txs) {
    map.set(tx.categoryId, (map.get(tx.categoryId) ?? 0) + tx.amountRial);
  }
  return [...map.entries()].map(([id, rial]) => ({ id, rial })).sort((a, b) => b.rial - a.rial);
}

/** Income → spending categories and savings for one period's transactions. */
export function moneyFlow(transactions: Transaction[], maxSinks = 5, maxSources = 3): MoneyFlow | null {
  const income = totals(transactions.filter(isIncomeLike));
  const spend = totals(transactions.filter(isExpenseLike));
  const incomeRial = income.reduce((s, n) => s + n.rial, 0);
  const spendRial = spend.reduce((s, n) => s + n.rial, 0);
  if (incomeRial <= 0 && spendRial <= 0) {
    return null;
  }
  const collapse = (nodes: FlowNode[], keep: number): FlowNode[] => {
    if (nodes.length <= keep + 1) {
      return nodes;
    }
    const rest = nodes.slice(keep).reduce((s, n) => s + n.rial, 0);
    return [...nodes.slice(0, keep), { id: 'other', rial: rest }];
  };
  const sources = collapse(income, maxSources);
  const sinks = collapse(spend, maxSinks);
  if (incomeRial > spendRial) {
    sinks.push({ id: 'savings', rial: incomeRial - spendRial });
  } else if (spendRial > incomeRial) {
    sources.push({ id: 'balance', rial: spendRial - incomeRial });
  }
  return { sources, sinks, totalRial: Math.max(incomeRial, spendRial) };
}
