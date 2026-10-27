import { sha256 } from 'js-sha256';
import type { FinancialAccount, SyncQueueItem, Transaction } from '../../types/finance';
import { getSupabase } from '../supabase/client';
import { markRetry } from './queue';

const UPSERT_CHUNK = 200;

export type FlushResult = {
  queue: SyncQueueItem[];
  /** False when there is no Supabase client or signed-in user; the queue is returned untouched. */
  ran: boolean;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Local ids (`tx_…`, `acc_sms_…`) are not UUIDs. Derive a stable UUID per user + local id
 * so the same local row always upserts or deletes the same cloud row.
 */
export function cloudIdFor(userId: string, localId: string): string {
  if (isUuid(localId)) {
    return localId.toLowerCase();
  }
  const hex = sha256(`mali:${userId}:${localId}`);
  // RFC 4122 variant bits (10xx) on the 17th hex digit.
  // eslint-disable-next-line no-bitwise
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Every key is always present (null or a default, never undefined). JSON drops undefined
 * keys, and PostgREST rejects a bulk upsert whose rows do not all have the same keys, so
 * one older record missing e.g. createdAt used to fail the whole batch.
 */
function accountRow(userId: string, a: FinancialAccount) {
  const now = new Date().toISOString();
  return {
    id: cloudIdFor(userId, a.id),
    user_id: userId,
    kind: a.kind ?? 'bank',
    bank_id: a.bankId ?? null,
    name: a.name ?? '',
    card_last4: a.cardLast4 ?? null,
    balance_rial: Math.round(Number(a.balanceRial) || 0),
    last_sync_at: a.lastSyncAt ?? null,
    transaction_count: a.transactionCount ?? 0,
    created_at: a.createdAt ?? now,
    updated_at: a.updatedAt ?? a.createdAt ?? now,
    local_id: a.id,
    payload: a,
  };
}

/** The raw SMS text stays on the device; everything else is kept for restore. */
export function cloudTransactionPayload(tx: Transaction): Omit<Transaction, 'sourceSmsPreview'> {
  const rest: Partial<Transaction> = { ...tx };
  delete rest.sourceSmsPreview;
  return rest as Omit<Transaction, 'sourceSmsPreview'>;
}

function transactionRow(userId: string, tx: Transaction, knownAccounts: Set<string>) {
  const stamp = tx.updatedAt ?? tx.createdAt ?? tx.transactionDate ?? new Date().toISOString();
  return {
    id: cloudIdFor(userId, tx.id),
    user_id: userId,
    account_id: knownAccounts.has(tx.accountId) ? cloudIdFor(userId, tx.accountId) : null,
    type: tx.type ?? 'purchase',
    direction: tx.direction ?? 'out',
    amount_rial: Math.round(Number(tx.amountRial) || 0),
    currency: tx.currency ?? 'IRR',
    merchant: tx.merchant ?? null,
    description: tx.description ?? null,
    category_id: tx.categoryId ?? null,
    transaction_date: tx.transactionDate ?? stamp,
    card_last4: tx.cardLast4 ?? null,
    source: tx.source ?? 'manual',
    source_id: tx.sourceId ?? null,
    fingerprint: tx.fingerprint ?? tx.id,
    confidence: tx.confidence ?? null,
    is_confirmed: tx.isConfirmed ?? false,
    needs_review: tx.needsReview ?? false,
    transfer_id: tx.transferId ? cloudIdFor(userId, tx.transferId) : null,
    notes: tx.notes ?? null,
    created_at: tx.createdAt ?? stamp,
    updated_at: stamp,
    local_id: tx.id,
    payload: cloudTransactionPayload(tx),
  };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'sync-failed';
}

type Client = NonNullable<ReturnType<typeof getSupabase>>;

async function upsertOnce(client: Client, table: string, rows: object[]): Promise<string | undefined> {
  try {
    const { error } = await client.from(table).upsert(rows);
    return error?.message;
  } catch (err) {
    return errorMessage(err);
  }
}

/**
 * Upserts rows in one request; if that fails, retries them one by one so a single bad
 * row only holds back itself. Returns the error per row index (undefined = stored).
 */
async function upsertIsolating(
  client: Client,
  table: string,
  rows: object[],
): Promise<(string | undefined)[]> {
  const bulkError = await upsertOnce(client, table, rows);
  if (!bulkError || rows.length === 1) {
    return rows.map(() => bulkError);
  }
  const errors: (string | undefined)[] = [];
  for (const row of rows) {
    errors.push(await upsertOnce(client, table, [row]));
  }
  return errors;
}

/**
 * Sends due queue items to Supabase. Synced items are dropped from the result.
 * Accounts go first, including every account a pending transaction points at, so the
 * transactions' account_id foreign key always resolves.
 */
export async function flushSyncQueue(
  queue: SyncQueueItem[],
  options: { accounts: FinancialAccount[] },
): Promise<FlushResult> {
  const client = getSupabase();
  if (!client) {
    return { queue, ran: false };
  }
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { queue, ran: false };
  }

  const now = Date.now();
  const results = new Map<string, SyncQueueItem | null>();
  const due: SyncQueueItem[] = [];
  for (const item of queue) {
    if (item.status === 'synced') {
      results.set(item.id, null);
    } else if (item.nextRetryAt && Date.parse(item.nextRetryAt) > now) {
      results.set(item.id, item);
    } else {
      due.push(item);
    }
  }

  const settle = (items: SyncQueueItem[], error?: string) => {
    for (const item of items) {
      results.set(item.id, error ? markRetry(item, error) : null);
    }
  };

  const accountsById = new Map(options.accounts.map(a => [a.id, a]));
  const accountItems = due.filter(item => item.entity === 'financial_accounts');
  const txItems = due.filter(item => item.entity === 'transactions');
  // Nothing else is uploaded yet; dropping keeps unknown entities from piling up.
  settle(due.filter(item => item.entity !== 'financial_accounts' && item.entity !== 'transactions'));

  // 1. Accounts: queued upserts plus any account a pending transaction references.
  const accountRows = new Map<string, FinancialAccount>();
  for (const item of accountItems) {
    if (item.operation === 'upsert') {
      const account = accountsById.get(item.entityId) ?? (JSON.parse(item.payload) as FinancialAccount);
      accountRows.set(account.id, account);
    }
  }
  const txUpserts: { item: SyncQueueItem; tx: Transaction }[] = [];
  for (const item of txItems) {
    if (item.operation === 'upsert') {
      const tx = JSON.parse(item.payload) as Transaction;
      txUpserts.push({ item, tx });
      const account = accountsById.get(tx.accountId);
      if (account) {
        accountRows.set(account.id, account);
      }
    }
  }
  const accountList = [...accountRows.values()];
  const accountErrors =
    accountList.length > 0
      ? await upsertIsolating(
          client,
          'financial_accounts',
          accountList.map(a => accountRow(user.id, a)),
        )
      : [];
  const accountError = new Map(accountList.map((a, i) => [a.id, accountErrors[i]]));
  for (const item of accountItems) {
    if (item.operation === 'upsert') {
      settle([item], accountError.get(item.entityId));
    }
  }
  // Only accounts that are really in the cloud may be referenced (account_id FK).
  const knownAccounts = new Set(accountList.filter(a => !accountError.get(a.id)).map(a => a.id));

  // 2. Transaction upserts, in chunks.
  for (let i = 0; i < txUpserts.length; i += UPSERT_CHUNK) {
    const chunk = txUpserts.slice(i, i + UPSERT_CHUNK);
    const errors = await upsertIsolating(
      client,
      'transactions',
      chunk.map(({ tx }) => transactionRow(user.id, tx, knownAccounts)),
    );
    chunk.forEach(({ item }, index) => settle([item], errors[index]));
  }

  // 3. Deletes.
  const deletes = due.filter(
    item =>
      item.operation === 'delete' &&
      (item.entity === 'transactions' || item.entity === 'financial_accounts'),
  );
  for (const item of deletes) {
    try {
      const { error } = await client
        .from(item.entity)
        .delete()
        .eq('id', cloudIdFor(user.id, item.entityId));
      settle([item], error?.message);
    } catch (err) {
      settle([item], errorMessage(err));
    }
  }

  const next: SyncQueueItem[] = [];
  for (const item of queue) {
    const result = results.has(item.id) ? results.get(item.id) : item;
    if (result) {
      next.push(result);
    }
  }
  return { queue: next, ran: true };
}
