import type { SupabaseClient } from '@supabase/supabase-js';
import type { FinancialAccount, Transaction } from '../../types/finance';
import { getSupabase } from '../supabase/client';
import { accountLooksValid, transactionLooksValid } from '../security/backup';

const PAGE = 1000;

type Row = Record<string, unknown>;

export type CloudRecords = {
  accounts: FinancialAccount[];
  transactions: Transaction[];
  /** Rows dropped because they were malformed (missing id, non-numeric amount, bad date…). */
  skipped: number;
};

export type PullResult =
  | { ok: true; records: CloudRecords }
  | { ok: false; error: 'not-configured' | 'signed-out' | string };

async function fetchAll(client: SupabaseClient, table: string, userId: string): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) {
      throw new Error(error.message);
    }
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < PAGE) {
      return rows;
    }
  }
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0));

/** Prefer the full local record; rows uploaded before payloads existed use the columns. */
export function accountFromRow(row: Row): FinancialAccount {
  if (row.payload && typeof row.payload === 'object') {
    return row.payload as FinancialAccount;
  }
  return {
    id: str(row.local_id) ?? String(row.id),
    userId: String(row.user_id),
    kind: (str(row.kind) ?? 'bank') as FinancialAccount['kind'],
    bankId: str(row.bank_id),
    name: str(row.name) ?? '',
    cardLast4: str(row.card_last4),
    balanceRial: num(row.balance_rial),
    lastSyncAt: str(row.last_sync_at),
    transactionCount: num(row.transaction_count),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function transactionFromRow(row: Row, localAccountId: Map<string, string>): Transaction {
  if (row.payload && typeof row.payload === 'object') {
    return row.payload as Transaction;
  }
  const cloudAccount = str(row.account_id);
  return {
    id: str(row.local_id) ?? String(row.id),
    userId: String(row.user_id),
    accountId: (cloudAccount && localAccountId.get(cloudAccount)) ?? cloudAccount ?? '',
    type: String(row.type) as Transaction['type'],
    direction: String(row.direction) as Transaction['direction'],
    amountRial: num(row.amount_rial),
    currency: (str(row.currency) ?? 'IRR') as Transaction['currency'],
    merchant: str(row.merchant),
    description: str(row.description),
    categoryId: (str(row.category_id) ?? 'other') as Transaction['categoryId'],
    transactionDate: String(row.transaction_date),
    cardLast4: str(row.card_last4),
    source: String(row.source) as Transaction['source'],
    sourceId: str(row.source_id),
    fingerprint: String(row.fingerprint),
    confidence: num(row.confidence),
    isConfirmed: Boolean(row.is_confirmed),
    needsReview: Boolean(row.needs_review),
    notes: str(row.notes),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

/** Reads every account and transaction the signed-in user has in the cloud. */
export async function pullCloudRecords(): Promise<PullResult> {
  const client = getSupabase();
  if (!client) {
    return { ok: false, error: 'not-configured' };
  }
  const { data } = await client.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) {
    return { ok: false, error: 'signed-out' };
  }
  try {
    const [accountRows, txRows] = await Promise.all([
      fetchAll(client, 'financial_accounts', userId),
      fetchAll(client, 'transactions', userId),
    ]);
    const localAccountId = new Map(
      accountRows.map(row => [String(row.id), str(row.local_id) ?? String(row.id)]),
    );
    // Cloud rows are not trusted blindly: a malformed payload would otherwise put NaN
    // balances or crashing records into the store. Same checks as backup restore.
    const accounts = accountRows.map(accountFromRow);
    const transactions = txRows.map(row => transactionFromRow(row, localAccountId));
    const validAccounts = accounts.filter(accountLooksValid);
    const validTransactions = transactions.filter(transactionLooksValid);
    return {
      ok: true,
      records: {
        accounts: validAccounts,
        transactions: validTransactions,
        skipped:
          accounts.length - validAccounts.length + transactions.length - validTransactions.length,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'pull-failed' };
  }
}
