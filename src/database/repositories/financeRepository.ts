import { LocalFinanceDb } from '../drivers/localDb';
import type { FinanceSnapshot } from '../schema/snapshot';
import type {
  FinancialAccount,
  SyncQueueItem,
  Transaction,
  UserSettings,
} from '../../types/finance';

let singleton: FinanceRepository | null = null;

export class FinanceRepository {
  constructor(private readonly db: LocalFinanceDb) {}

  snapshot(): FinanceSnapshot {
    return this.db.load();
  }

  commit(mutator: (s: FinanceSnapshot) => FinanceSnapshot): FinanceSnapshot {
    const next = mutator(this.db.load());
    this.db.save(next);
    return next;
  }

  listTransactions(params: { offset: number; limit: number; query?: string; type?: string }): Transaction[] {
    const all = [...this.snapshot().transactions].sort((a, b) =>
      b.transactionDate.localeCompare(a.transactionDate),
    );
    const filtered = all.filter(tx => {
      if (params.type && params.type !== 'all') {
        if (params.type === 'expense' && tx.direction !== 'out') {
          return false;
        }
        if (params.type === 'income' && tx.direction !== 'in') {
          return false;
        }
        if (params.type === 'transfer' && tx.type !== 'transfer' && !tx.transferId) {
          return false;
        }
      }
      if (params.query) {
        const q = params.query.toLowerCase();
        const hay = `${tx.merchant ?? ''} ${tx.description ?? ''}`.toLowerCase();
        if (!hay.includes(q)) {
          return false;
        }
      }
      return true;
    });
    return filtered.slice(params.offset, params.offset + params.limit);
  }

  upsertAccount(account: FinancialAccount): void {
    this.commit(s => ({
      ...s,
      accounts: [...s.accounts.filter(a => a.id !== account.id), account],
    }));
  }

  insertTransaction(tx: Transaction): void {
    this.commit(s => ({ ...s, transactions: [tx, ...s.transactions] }));
  }

  updateSettings(patch: Partial<UserSettings>): void {
    this.commit(s => ({ ...s, settings: { ...s.settings, ...patch } }));
  }

  enqueue(item: SyncQueueItem): void {
    this.commit(s => ({ ...s, syncQueue: [...s.syncQueue, item] }));
  }
}

export function getRepository(): FinanceRepository {
  if (!singleton) {
    throw new Error('FinanceRepository not initialized — call hydrate() first');
  }
  return singleton;
}

export function bindRepository(repo: FinanceRepository): void {
  singleton = repo;
}
