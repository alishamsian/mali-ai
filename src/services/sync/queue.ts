import type { SyncQueueItem } from '../../types/finance';

let queueSeq = 0;

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
  queueSeq = (queueSeq + 1) % 1_000_000;
  return {
    // Sequence keeps ids unique when one entity is queued twice in the same millisecond.
    id: `sync_${Date.now()}_${queueSeq}_${entityId}`,
    entity,
    entityId,
    operation,
    payload: JSON.stringify(payload),
    status: 'pending',
    attempts: 0,
    createdAt: new Date().toISOString(),
  };
}

function queueKey(item: SyncQueueItem): string {
  return `${item.entity}:${item.entityId}`;
}

/**
 * Drops synced items and keeps only the latest item per entity: the newest payload
 * (or a delete) supersedes everything queued before it, so the queue is bounded by
 * the number of entities with unsent changes instead of growing with every edit.
 */
export function compactSyncQueue(queue: SyncQueueItem[]): SyncQueueItem[] {
  const lastIndex = new Map<string, number>();
  queue.forEach((item, index) => {
    if (item.status !== 'synced') {
      lastIndex.set(queueKey(item), index);
    }
  });
  return queue.filter(
    (item, index) => item.status !== 'synced' && lastIndex.get(queueKey(item)) === index,
  );
}

export function enqueueSync(queue: SyncQueueItem[], item: SyncQueueItem): SyncQueueItem[] {
  const key = queueKey(item);
  return [...queue.filter(existing => queueKey(existing) !== key), item];
}

/**
 * Folds a finished flush into the queue as it is now. `sent` is what the flush started
 * with and `flushed` what it returned; anything enqueued meanwhile is kept and, being
 * newer, wins over a retry of the same entity.
 */
export function mergeFlushedQueue(
  current: SyncQueueItem[],
  sent: SyncQueueItem[],
  flushed: SyncQueueItem[],
): SyncQueueItem[] {
  const sentIds = new Set(sent.map(item => item.id));
  const currentIds = new Set(current.map(item => item.id));
  // An item that left `current` during the flush was superseded; do not resurrect it.
  const stillQueued = flushed.filter(item => currentIds.has(item.id));
  const added = current.filter(item => !sentIds.has(item.id));
  return compactSyncQueue([...stillQueued, ...added]);
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
