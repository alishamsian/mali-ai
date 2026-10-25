import type { SyncQueueItem } from '../../types/finance';

export function nextBackoffMs(attempts: number): number {
  const base = 2000;
  return Math.min(base * 2 ** attempts, 15 * 60 * 1000);
}

export function createQueueItem(
  entity: string,
  entityId: string,
  operation: SyncQueueItem['operation'],
  payload: unknown,
): SyncQueueItem {
  return {
    id: `sync_${Date.now()}_${entityId}`,
    entity,
    entityId,
    operation,
    payload: JSON.stringify(payload),
    status: 'pending',
    attempts: 0,
    createdAt: new Date().toISOString(),
  };
}

export function markRetry(item: SyncQueueItem, error: string): SyncQueueItem {
  const attempts = item.attempts + 1;
  return {
    ...item,
    status: 'failed',
    attempts,
    lastError: error,
    nextRetryAt: new Date(Date.now() + nextBackoffMs(attempts)).toISOString(),
  };
}
