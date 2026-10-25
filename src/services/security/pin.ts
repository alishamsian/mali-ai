import { Platform } from 'react-native';
import { sha256 } from 'js-sha256';
import { secureRandomHex } from './secureRandom';

/**
 * PIN hash + salt live in Keychain/Keystore only (never MMKV).
 * Jest uses an in-memory fallback.
 */
const PEPPER = 'mali-vault-v2';
const MAX_FAILS = 5;
const BASE_LOCK_MS = 30_000;
const PIN_SERVICE = 'ir.maliai.pin';

export type PinRecord = { hash: string; salt: string; fails: number; until: number };

let keychain: typeof import('react-native-keychain') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  keychain = require('react-native-keychain');
} catch {
  keychain = null;
}

let memoryRecord: PinRecord | null = null;

function randomSalt(): string {
  return secureRandomHex(16);
}

export function pinLooksValid(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

export function hashPin(pin: string, salt: string): string {
  return sha256(`${PEPPER}:${salt}:${pin}`);
}

function parseRecord(raw: string): PinRecord | null {
  try {
    const parsed = JSON.parse(raw) as PinRecord;
    if (parsed && typeof parsed.hash === 'string' && typeof parsed.salt === 'string') {
      return {
        hash: parsed.hash,
        salt: parsed.salt,
        fails: parsed.fails ?? 0,
        until: parsed.until ?? 0,
      };
    }
  } catch {
    // legacy v1: hash only string
    if (raw.length > 8 && !raw.startsWith('{')) {
      return null;
    }
  }
  return null;
}

function useMemoryFallback(): boolean {
  const jestWorker = (globalThis as { process?: { env?: { JEST_WORKER_ID?: string } } }).process?.env
    ?.JEST_WORKER_ID;
  return Boolean(jestWorker) || !keychain;
}

async function readKeychain(): Promise<PinRecord | null> {
  if (useMemoryFallback()) {
    return memoryRecord;
  }
  try {
    const result = await keychain!.getGenericPassword({ service: PIN_SERVICE });
    if (result && typeof result.password === 'string') {
      return parseRecord(result.password);
    }
  } catch {
    // ignore
  }
  return null;
}

async function writeKeychain(record: PinRecord | null): Promise<void> {
  if (useMemoryFallback()) {
    memoryRecord = record;
    return;
  }
  try {
    if (!record) {
      await keychain!.resetGenericPassword({ service: PIN_SERVICE });
      return;
    }
    await keychain!.setGenericPassword('pin', JSON.stringify(record), {
      service: PIN_SERVICE,
      accessible: keychain!.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      ...(Platform.OS === 'android'
        ? { securityLevel: keychain!.SECURITY_LEVEL.SECURE_HARDWARE }
        : {}),
    });
  } catch {
    memoryRecord = record;
  }
}

export async function storePin(pin: string): Promise<void> {
  if (!pinLooksValid(pin)) {
    throw new Error('invalid-pin');
  }
  const salt = randomSalt();
  const hash = hashPin(pin, salt);
  await writeKeychain({ hash, salt, fails: 0, until: 0 });
}

/** @deprecated Use storePin — accepts pre-hashed legacy migration only */
export async function storePinHash(hash: string): Promise<void> {
  await writeKeychain({ hash, salt: 'legacy', fails: 0, until: 0 });
}

export async function loadPinHash(): Promise<string | null> {
  const record = await readKeychain();
  return record?.hash ?? null;
}

export async function hasStoredPin(): Promise<boolean> {
  return Boolean(await readKeychain());
}

export async function clearPinHash(): Promise<void> {
  memoryRecord = null;
  await writeKeychain(null);
}

export async function pinLockRemainingMs(): Promise<number> {
  const record = await readKeychain();
  if (!record) {
    return 0;
  }
  return Math.max(0, record.until - Date.now());
}

export async function pinMatches(pin: string): Promise<boolean> {
  if (!pinLooksValid(pin)) {
    return false;
  }
  const record = await readKeychain();
  if (!record) {
    return false;
  }
  if (record.salt === 'legacy') {
    return record.hash === sha256(`mali-vault-v1:${pin}`);
  }
  return record.hash === hashPin(pin, record.salt);
}

export async function recordPinSuccess(): Promise<void> {
  const record = await readKeychain();
  if (!record) {
    return;
  }
  await writeKeychain({ ...record, fails: 0, until: 0 });
}

export async function recordPinFailure(): Promise<number> {
  const record = await readKeychain();
  if (!record) {
    return 0;
  }
  const fails = record.fails + 1;
  const extra = Math.max(0, fails - MAX_FAILS);
  const until = fails >= MAX_FAILS ? Date.now() + BASE_LOCK_MS * 2 ** extra : 0;
  await writeKeychain({ ...record, fails, until });
  return Math.max(0, until - Date.now());
}

export function __resetPinMemoryForTests(): void {
  memoryRecord = null;
}
