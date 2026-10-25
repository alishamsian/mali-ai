import type { SyncQueueItem } from '../../types/finance';
import { getSupabase } from '../supabase/client';
import { markRetry } from './queue';

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function flushSyncQueue(queue: SyncQueueItem[]): Promise<SyncQueueItem[]> {
  const client = getSupabase();
  if (!client) {
    return queue;
  }
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return queue;
  }

  const now = Date.now();
  const next: SyncQueueItem[] = [];
  for (const item of queue) {
    if (item.status === 'synced') {
      next.push(item);
      continue;
    }
    if (item.nextRetryAt && Date.parse(item.nextRetryAt) > now) {
      next.push(item);
      continue;
    }
    try {
      if (item.entity === 'transactions') {
        if (!isUuid(item.entityId)) {
          next.push(markRetry(item, 'local-id: wait for cloud identity mapping'));
          continue;
        }
        const payload = JSON.parse(item.payload) as Record<string, unknown>;
        const { error } = await client.from('transactions').upsert({
          id: item.entityId,
          user_id: user.id,
          account_id: payload.accountId,
          type: payload.type,
          direction: payload.direction,
          amount_rial: payload.amountRial,
          currency: payload.currency ?? 'IRR',
          merchant: payload.merchant,
          description: payload.description,
          category_id: payload.categoryId,
          transaction_date: payload.transactionDate,
          card_last4: payload.cardLast4,
          source: payload.source,
          fingerprint: payload.fingerprint,
          confidence: payload.confidence,
          is_confirmed: payload.isConfirmed,
          needs_review: payload.needsReview,
          notes: payload.notes,
        });
        if (error) {
          next.push(markRetry(item, error.message));
          continue;
        }
      }
      next.push({ ...item, status: 'synced', lastError: undefined });
    } catch (err) {
      next.push(markRetry(item, err instanceof Error ? err.message : 'sync-failed'));
    }
  }
  return next;
}
