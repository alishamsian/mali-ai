import { Platform } from 'react-native';
import { secureRandomHex } from './secureRandom';

const SERVICE = 'ir.maliai.storage';
const ACCOUNT = 'mmkv-key';

let keychain: typeof import('react-native-keychain') | null = null;
try {
  keychain = require('react-native-keychain');
} catch {
  keychain = null;
}

export type StorageKeyErrorCode =
  | 'keychain-unavailable'
  | 'keychain-read'
  | 'keychain-write'
  | 'key-missing';

/**
 * Thrown instead of silently inventing a new key. A fresh key would open the
 * encrypted store as empty and the next save would overwrite the user's data.
 */
export class StorageKeyError extends Error {
  constructor(readonly code: StorageKeyErrorCode, cause?: unknown) {
    super(`storage-key:${code}`);
    this.name = 'StorageKeyError';
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

let memoryKey: string | null = null;

async function readStoredKey(kc: NonNullable<typeof keychain>): Promise<string | null> {
  try {
    const existing = await kc.getGenericPassword({ service: SERVICE });
    if (existing && typeof existing.password === 'string' && existing.password.length >= 16) {
      return existing.password;
    }
    return null;
  } catch (e) {
    throw new StorageKeyError('keychain-read', e);
  }
}

/**
 * Returns the MMKV AES key (16 bytes as 32 hex chars).
 * `allowCreate` must be false once an encrypted store is known to exist —
 * then a missing key is an error, never a reason to start over.
 */
export async function getOrCreateMmkvEncryptionKey(options: {
  allowCreate: boolean;
}): Promise<string> {
  if (memoryKey) {
    return memoryKey;
  }
  const kc = keychain;
  if (!kc) {
    throw new StorageKeyError('keychain-unavailable');
  }
  const existing = await readStoredKey(kc);
  if (existing) {
    memoryKey = existing;
    return existing;
  }
  if (!options.allowCreate) {
    throw new StorageKeyError('key-missing');
  }
  const created = secureRandomHex(16);
  const base = {
    service: SERVICE,
    accessible: kc.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  };
  try {
    await kc.setGenericPassword(ACCOUNT, created, {
      ...base,
      ...(Platform.OS === 'android' ? { securityLevel: kc.SECURITY_LEVEL.SECURE_HARDWARE } : {}),
    });
  } catch {
    // Devices without hardware-backed Keystore reject SECURE_HARDWARE.
    try {
      await kc.setGenericPassword(ACCOUNT, created, base);
    } catch (e) {
      throw new StorageKeyError('keychain-write', e);
    }
  }
  // Read back: some Keystore implementations report success without persisting.
  if ((await readStoredKey(kc)) !== created) {
    throw new StorageKeyError('keychain-write');
  }
  memoryKey = created;
  return created;
}

export function __resetStorageKeyForTests(): void {
  memoryKey = null;
}
