import type { StorageDriver } from './localDb';
import { MemoryStorage } from './memory';
import { bootstrapStorage } from './storageBootstrap';

/** @deprecated Use bootstrapStorage() during app hydrate */
export function createStorage(): StorageDriver {
  const jestWorker = (globalThis as { process?: { env?: { JEST_WORKER_ID?: string } } }).process?.env
    ?.JEST_WORKER_ID;
  if (jestWorker) {
    return new MemoryStorage();
  }
  throw new Error('createStorage: call bootstrapStorage() after hydrate');
}

export { bootstrapStorage };
