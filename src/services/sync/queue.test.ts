import type { SyncQueueItem } from '../../types/finance';
import { compactSyncQueue, createQueueItem, enqueueSync, mergeFlushedQueue } from './queue';

const item = (entityId: string, operation: SyncQueueItem['operation'] = 'upsert', extra = {}) => ({
  ...createQueueItem('transactions', entityId, operation, { id: entityId, ...extra }),
});

describe('sync queue (bug 4)', () => {
  it('gives unique ids to items for the same entity created in the same millisecond', () => {
    const spy = jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const a = item('tx_1');
    const b = item('tx_1');
    spy.mockRestore();
    expect(a.id).not.toBe(b.id);
  });

  it('enqueueSync keeps only the newest item per entity', () => {
    let queue: SyncQueueItem[] = [];
    queue = enqueueSync(queue, item('tx_1', 'upsert', { v: 1 }));
    queue = enqueueSync(queue, item('tx_2'));
    queue = enqueueSync(queue, item('tx_1', 'upsert', { v: 2 }));
    queue = enqueueSync(queue, item('tx_1', 'delete'));
    expect(queue.map(q => [q.entityId, q.operation])).toEqual([
      ['tx_2', 'upsert'],
      ['tx_1', 'delete'],
    ]);
  });

  it('does not coalesce different entities that share an id', () => {
    const queue = enqueueSync(
      [item('x_1')],
      createQueueItem('financial_accounts', 'x_1', 'upsert', {}),
    );
    expect(queue).toHaveLength(2);
  });

  it('compactSyncQueue drops synced items and older duplicates', () => {
    const synced = { ...item('tx_1'), status: 'synced' as const };
    const old = item('tx_2', 'upsert', { v: 1 });
    const newer = item('tx_2', 'upsert', { v: 2 });
    const compacted = compactSyncQueue([synced, old, item('tx_3'), newer]);
    expect(compacted.map(q => q.entityId)).toEqual(['tx_3', 'tx_2']);
    expect(JSON.parse(compacted[1].payload).v).toBe(2);
  });

  it('compacts a large legacy queue down to one item per entity', () => {
    const legacy: SyncQueueItem[] = [];
    for (let i = 0; i < 5_000; i += 1) {
      legacy.push({ ...item(`tx_${i % 50}`), status: i % 2 ? 'synced' : 'failed' });
    }
    expect(compactSyncQueue(legacy).length).toBeLessThanOrEqual(50);
  });

  describe('mergeFlushedQueue', () => {
    it('keeps items enqueued during the flush and drops sent items that synced', () => {
      const sent = [item('tx_1'), item('tx_2')];
      const added = item('tx_3');
      const merged = mergeFlushedQueue([...sent, added], sent, []);
      expect(merged.map(q => q.entityId)).toEqual(['tx_3']);
    });

    it('keeps failed retries, but a newer edit of the same entity wins', () => {
      const sent = [item('tx_1'), item('tx_2')];
      const failed = sent.map(q => ({ ...q, status: 'failed' as const, attempts: 1 }));
      const newer = item('tx_2', 'upsert', { v: 'new' });
      const current = enqueueSync(sent, newer);
      const merged = mergeFlushedQueue(current, sent, failed);
      expect(merged.map(q => q.entityId)).toEqual(['tx_1', 'tx_2']);
      expect(merged[0].status).toBe('failed');
      expect(merged[1].id).toBe(newer.id);
    });
  });
});
