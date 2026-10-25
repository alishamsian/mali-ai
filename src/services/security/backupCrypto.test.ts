import { emptySnapshot } from '../../database/schema/snapshot';
import { buildSanitizedBackup } from './backup';
import {
  decryptBackupJson,
  encryptBackupPayload,
  encryptSnapshotBackup,
  isEncryptedBackupJson,
} from './backupCrypto';

describe('backupCrypto', () => {
  const password = 'strong-password-123';

  it('encrypts and decrypts round-trip', () => {
    const payload = buildSanitizedBackup(emptySnapshot());
    const envelope = encryptBackupPayload(payload, password);
    expect(envelope.format).toBe('mali-backup-encrypted');
    const raw = JSON.stringify(envelope);
    expect(isEncryptedBackupJson(raw)).toBe(true);
    const decrypted = decryptBackupJson(raw, password);
    expect(decrypted.ok).toBe(true);
    if (decrypted.ok) {
      expect(decrypted.data.transactions).toEqual(payload.transactions);
    }
  });

  it('rejects wrong password', () => {
    const raw = encryptSnapshotBackup(emptySnapshot(), password);
    const result = decryptBackupJson(raw, 'wrong-password');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('mac');
    }
  });
});
