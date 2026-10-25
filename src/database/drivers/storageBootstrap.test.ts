/**
 * Real openSecureStorage() path with fake MMKV (per id, key-aware) and Keychain.
 * Guards against the old behaviour of silently inventing a new key.
 */
const mockDisk = new Map<string, { key?: string; data: Map<string, string> }>();
const mockKeychain: {
  stored: string | null;
  failRead: boolean;
  failWrite: boolean;
} = { stored: null, failRead: false, failWrite: false };

jest.mock('react-native-mmkv', () => ({
  MMKV: class {
    private readonly file: { key?: string; data: Map<string, string> };
    private readonly readable: boolean;
    constructor({ id, encryptionKey }: { id: string; encryptionKey?: string }) {
      if (!mockDisk.has(id)) {
        mockDisk.set(id, { key: encryptionKey, data: new Map() });
      }
      this.file = mockDisk.get(id)!;
      // Wrong key → contents look empty, like decrypting with the wrong AES key.
      this.readable = this.file.key === encryptionKey;
    }
    getString(k: string) {
      return this.readable ? this.file.data.get(k) : undefined;
    }
    set(k: string, v: string) {
      if (!this.readable) {
        // Simulate MMKV re-keying the file with whatever key it was opened with.
        this.file.data.clear();
      }
      this.file.data.set(k, v);
    }
    delete(k: string) {
      this.file.data.delete(k);
    }
    clearAll() {
      this.file.data.clear();
    }
  },
}));

jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'x' },
  SECURITY_LEVEL: { SECURE_HARDWARE: 'hw' },
  getGenericPassword: jest.fn(async () => {
    if (mockKeychain.failRead) {
      throw new Error('keystore locked');
    }
    return mockKeychain.stored ? { username: 'mmkv-key', password: mockKeychain.stored } : false;
  }),
  setGenericPassword: jest.fn(async (_u: string, password: string) => {
    if (mockKeychain.failWrite) {
      throw new Error('keystore write failed');
    }
    mockKeychain.stored = password;
    return true;
  }),
  resetGenericPassword: jest.fn(async () => true),
}));

import { openSecureStorage } from './storageBootstrap';
import { __resetStorageKeyForTests, StorageKeyError } from '../../services/security/storageKey';
import { LocalFinanceDb } from './localDb';

function relaunch() {
  __resetStorageKeyForTests();
}

describe('openSecureStorage', () => {
  beforeEach(() => {
    mockDisk.clear();
    mockKeychain.stored = null;
    mockKeychain.failRead = false;
    mockKeychain.failWrite = false;
    relaunch();
  });

  it('creates a 128-bit key on first launch and reopens with it', async () => {
    const first = await openSecureStorage();
    first.set('mali.finance.v1', '{"x":1}');
    expect(mockKeychain.stored).toMatch(/^[0-9a-f]{32}$/);

    relaunch();
    const second = await openSecureStorage();
    expect(second.get('mali.finance.v1')).toBe('{"x":1}');
  });

  it('refuses to create a new key when the store exists but the key is gone', async () => {
    (await openSecureStorage()).set('mali.finance.v1', '{"x":1}');
    mockKeychain.stored = null;
    relaunch();

    await expect(openSecureStorage()).rejects.toMatchObject({ code: 'key-missing' });
    expect(mockKeychain.stored).toBeNull();
  });

  it('throws on a Keychain read error instead of using a throwaway key', async () => {
    (await openSecureStorage()).set('mali.finance.v1', '{"x":1}');
    mockKeychain.failRead = true;
    relaunch();

    await expect(openSecureStorage()).rejects.toBeInstanceOf(StorageKeyError);

    mockKeychain.failRead = false;
    relaunch();
    expect((await openSecureStorage()).get('mali.finance.v1')).toBe('{"x":1}');
  });

  it('detects a wrong key via the canary and does not touch the data', async () => {
    (await openSecureStorage()).set('mali.finance.v1', '{"x":1}');
    const realKey = mockKeychain.stored;
    mockKeychain.stored = 'ffffffffffffffffffffffffffffffff';
    relaunch();

    await expect(openSecureStorage()).rejects.toMatchObject({ code: 'key-mismatch' });

    mockKeychain.stored = realKey;
    relaunch();
    expect((await openSecureStorage()).get('mali.finance.v1')).toBe('{"x":1}');
  });

  it('fails first launch when the key cannot be persisted', async () => {
    mockKeychain.failWrite = true;
    await expect(openSecureStorage()).rejects.toMatchObject({ code: 'keychain-write' });
  });
});

describe('LocalFinanceDb corrupt snapshot', () => {
  it('keeps a copy of unreadable data before returning an empty snapshot', () => {
    const mem = new Map<string, string>([['mali.finance.v1', '{not json']]);
    const db = new LocalFinanceDb({
      get: k => mem.get(k),
      set: (k, v) => {
        mem.set(k, v);
      },
    });
    db.load();
    const backups = [...mem.keys()].filter(k => k.startsWith('mali.finance.v1.corrupt.'));
    expect(backups).toHaveLength(1);
    expect(mem.get(backups[0])).toBe('{not json');
  });
});
