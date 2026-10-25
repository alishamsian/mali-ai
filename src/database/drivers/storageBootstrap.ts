import { MMKV } from 'react-native-mmkv';
import type { StorageDriver } from './localDb';
import { MemoryStorage } from './memory';
import { MmkvStorage } from './mmkv';
import { getOrCreateMmkvEncryptionKey } from '../../services/security/storageKey';

const FINANCE_KEY = 'mali.finance.v1';
const LEGACY_ID = 'mali-finance';
const SECURE_ID = 'mali-finance-secure';
/** Unencrypted, holds no user data — only remembers that a secure store exists. */
const META_ID = 'mali-meta';
const META_SECURE_CREATED = 'secureStore.created';
/** Known value inside the encrypted store; reading it back proves the key is right. */
const CANARY_KEY = 'mali.canary';
const CANARY_VALUE = 'mali-ok-v1';

export type StorageUnavailableCode = 'key-mismatch';

export class StorageUnavailableError extends Error {
  constructor(readonly code: StorageUnavailableCode) {
    super(`storage-unavailable:${code}`);
    this.name = 'StorageUnavailableError';
  }
}

let driver: StorageDriver | null = null;

function migrateLegacyInto(secure: MMKV): void {
  try {
    const legacy = new MMKV({ id: LEGACY_ID });
    const raw = legacy.getString(FINANCE_KEY);
    if (!raw) {
      return;
    }
    secure.set(FINANCE_KEY, raw);
    legacy.delete(FINANCE_KEY);
  } catch {
    // ignore — fresh install
  }
}

/**
 * Opens the encrypted store or throws. Never substitutes a new key or an
 * in-memory store: either would show an empty app and the next save would
 * destroy the real data.
 */
export async function openSecureStorage(): Promise<StorageDriver> {
  const meta = new MMKV({ id: META_ID });
  const secureExists = meta.getString(META_SECURE_CREATED) === '1';
  const encryptionKey = await getOrCreateMmkvEncryptionKey({ allowCreate: !secureExists });
  const secureKv = new MMKV({ id: SECURE_ID, encryptionKey });
  const canary = secureKv.getString(CANARY_KEY);
  if (canary !== CANARY_VALUE) {
    if (secureExists) {
      throw new StorageUnavailableError('key-mismatch');
    }
    // First launch, or upgrade from a build that predates the canary.
    secureKv.set(CANARY_KEY, CANARY_VALUE);
  }
  if (!secureExists) {
    meta.set(META_SECURE_CREATED, '1');
  }
  migrateLegacyInto(secureKv);
  return new MmkvStorage(secureKv);
}

export async function bootstrapStorage(): Promise<StorageDriver> {
  if (driver) {
    return driver;
  }
  const jestWorker = (globalThis as { process?: { env?: { JEST_WORKER_ID?: string } } }).process?.env
    ?.JEST_WORKER_ID;
  if (jestWorker) {
    driver = new MemoryStorage();
    return driver;
  }
  driver = await openSecureStorage();
  return driver;
}

export function getStorageDriver(): StorageDriver {
  if (!driver) {
    throw new Error('Storage not bootstrapped — call bootstrapStorage() first');
  }
  return driver;
}

export function __resetStorageBootstrapForTests(): void {
  driver = null;
}
