import CryptoJS from 'crypto-js';
import type { BackupPayload } from './backup';
import { BACKUP_FORMAT, BACKUP_FORMAT_VERSION, buildSanitizedBackup } from './backup';
import type { FinanceSnapshot } from '../../database/schema/snapshot';

export const ENCRYPTED_BACKUP_FORMAT = 'mali-backup-encrypted' as const;
export const BACKUP_CRYPTO_VERSION = 1;
const PBKDF2_ITERATIONS = 120_000;
const MIN_BACKUP_PASSWORD_LEN = 8;

export type EncryptedBackupEnvelope = {
  format: typeof ENCRYPTED_BACKUP_FORMAT;
  cryptoVersion: number;
  payloadVersion: number;
  kdf: 'pbkdf2-sha256';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
  mac: string;
};

function deriveKeys(password: string, salt: CryptoJS.lib.WordArray): {
  encKey: CryptoJS.lib.WordArray;
  macKey: CryptoJS.lib.WordArray;
} {
  const derived = CryptoJS.PBKDF2(password, salt, {
    keySize: 16,
    iterations: PBKDF2_ITERATIONS,
    hasher: CryptoJS.algo.SHA256,
  });
  return {
    encKey: CryptoJS.lib.WordArray.create(derived.words.slice(0, 8)),
    macKey: CryptoJS.lib.WordArray.create(derived.words.slice(8, 16)),
  };
}

function computeMac(
  macKey: CryptoJS.lib.WordArray,
  salt: string,
  iv: string,
  ciphertext: string,
): string {
  return CryptoJS.HmacSHA256(`${salt}:${iv}:${ciphertext}`, macKey).toString(CryptoJS.enc.Hex);
}

export function backupPasswordValid(password: string): boolean {
  return password.length >= MIN_BACKUP_PASSWORD_LEN;
}

export function encryptBackupPayload(payload: BackupPayload, password: string): EncryptedBackupEnvelope {
  if (!backupPasswordValid(password)) {
    throw new Error('weak-password');
  }
  const saltWa = CryptoJS.lib.WordArray.random(16);
  const ivWa = CryptoJS.lib.WordArray.random(16);
  const { encKey, macKey } = deriveKeys(password, saltWa);
  const encrypted = CryptoJS.AES.encrypt(JSON.stringify(payload), encKey, {
    iv: ivWa,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  const salt = saltWa.toString(CryptoJS.enc.Hex);
  const iv = ivWa.toString(CryptoJS.enc.Hex);
  const ciphertext = encrypted.ciphertext.toString(CryptoJS.enc.Base64);
  const mac = computeMac(macKey, salt, iv, ciphertext);
  return {
    format: ENCRYPTED_BACKUP_FORMAT,
    cryptoVersion: BACKUP_CRYPTO_VERSION,
    payloadVersion: BACKUP_FORMAT_VERSION,
    kdf: 'pbkdf2-sha256',
    iterations: PBKDF2_ITERATIONS,
    salt,
    iv,
    ciphertext,
    mac,
  };
}

export function encryptSnapshotBackup(snapshot: FinanceSnapshot, password: string): string {
  const envelope = encryptBackupPayload(buildSanitizedBackup(snapshot), password);
  return JSON.stringify(envelope, null, 2);
}

export function decryptBackupEnvelope(
  envelope: EncryptedBackupEnvelope,
  password: string,
): { ok: true; data: BackupPayload } | { ok: false; error: string } {
  if (envelope.format !== ENCRYPTED_BACKUP_FORMAT) {
    return { ok: false, error: 'format' };
  }
  if (envelope.cryptoVersion > BACKUP_CRYPTO_VERSION) {
    return { ok: false, error: 'version' };
  }
  try {
    const saltWa = CryptoJS.enc.Hex.parse(envelope.salt);
    const ivWa = CryptoJS.enc.Hex.parse(envelope.iv);
    const { encKey, macKey } = deriveKeys(password, saltWa);
    const expectedMac = computeMac(macKey, envelope.salt, envelope.iv, envelope.ciphertext);
    if (expectedMac !== envelope.mac) {
      return { ok: false, error: 'mac' };
    }
    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: CryptoJS.enc.Base64.parse(envelope.ciphertext),
    });
    const decrypted = CryptoJS.AES.decrypt(cipherParams, encKey, {
      iv: ivWa,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
    if (!plaintext) {
      return { ok: false, error: 'decrypt' };
    }
    const parsed = JSON.parse(plaintext) as BackupPayload;
    if (parsed.format !== BACKUP_FORMAT) {
      return { ok: false, error: 'payload-format' };
    }
    return { ok: true, data: parsed };
  } catch {
    return { ok: false, error: 'decrypt' };
  }
}

export function isEncryptedBackupJson(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw) as { format?: string };
    return parsed?.format === ENCRYPTED_BACKUP_FORMAT;
  } catch {
    return false;
  }
}

export function decryptBackupJson(
  raw: string,
  password: string,
): { ok: true; data: BackupPayload } | { ok: false; error: string } {
  try {
    const envelope = JSON.parse(raw) as EncryptedBackupEnvelope;
    return decryptBackupEnvelope(envelope, password);
  } catch {
    return { ok: false, error: 'parse' };
  }
}
