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

function shouldUseMemoryFallback(): boolean {
  const jestWorker = (globalThis as { process?: { env?: { JEST_WORKER_ID?: string } } }).process?.env
    ?.JEST_WORKER_ID;
  return Boolean(jestWorker) || !keychain;
}

async function readKeychain(): Promise<PinRecord | null> {
  if (shouldUseMemoryFallback()) {
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

/**
 * Throws `pin-store-failed` when the Keychain write fails. It used to fall back to an
 * in-memory record that production reads never consult, so a "saved" PIN or a failure
 * count could silently vanish.
 */
async function writeKeychain(record: PinRecord | null): Promise<void> {
  if (shouldUseMemoryFallback()) {
    memoryRecord = record;
    return;
  }
  try {
    if (!record) {
      await keychain!.resetGenericPassword({ service: PIN_SERVICE });
      return;
    }
    const ok = await keychain!.setGenericPassword('pin', JSON.stringify(record), {
      service: PIN_SERVICE,
      accessible: keychain!.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      ...(Platform.OS === 'android'
        ? { securityLevel: keychain!.SECURITY_LEVEL.SECURE_HARDWARE }
        : {}),
    });
    if (ok === false) {
      throw new Error('keychain-write-false');
    }
  } catch {
    throw new Error('pin-store-failed');
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
  sessionFails = 0;
  sessionLockUntil = 0;
  await writeKeychain(null);
}

/** Lockout kept in memory when the Keychain could not record a failure. */
let sessionLockUntil = 0;
let sessionFails = 0;

export async function pinLockRemainingMs(): Promise<number> {
  const record = await readKeychain();
  const until = Math.max(record?.until ?? 0, sessionLockUntil);
  return Math.max(0, until - Date.now());
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
  sessionFails = 0;
  sessionLockUntil = 0;
  const record = await readKeychain();
  if (!record) {
    return;
  }
  try {
    await writeKeychain({ ...record, fails: 0, until: 0 });
  } catch {
    // The unlock already succeeded; a stale counter only means a stricter next lockout.
  }
}

function lockUntilFor(fails: number): number {
  const extra = Math.max(0, fails - MAX_FAILS);
  return fails >= MAX_FAILS ? Date.now() + BASE_LOCK_MS * 2 ** extra : 0;
}

export async function recordPinFailure(): Promise<number> {
  const record = await readKeychain();
  if (!record) {
    return 0;
  }
  // Count from whichever is further along, so a failed write can't reset the counter.
  const fails = Math.max(record.fails, sessionFails) + 1;
  const until = lockUntilFor(fails);
  sessionFails = fails;
  sessionLockUntil = until;
  try {
    await writeKeychain({ ...record, fails, until });
  } catch {
    // Keychain unavailable: the in-memory lockout above still applies for this session.
  }
  return Math.max(0, until - Date.now());
}

export function __resetPinMemoryForTests(): void {
  memoryRecord = null;
  sessionFails = 0;
  sessionLockUntil = 0;
}
