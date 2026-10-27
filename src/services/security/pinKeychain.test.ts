/**
 * Exercises the real Keychain path (pin.test.ts covers the Jest in-memory fallback).
 * JEST_WORKER_ID switches pin.ts to that fallback, so it is cleared while these run.
 */
const keychainStore: { value: string | null; failWrites: boolean } = {
  value: null,
  failWrites: false,
};

jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'w' },
  SECURITY_LEVEL: { SECURE_HARDWARE: 's' },
  getGenericPassword: jest.fn(async () =>
    keychainStore.value == null ? false : { username: 'pin', password: keychainStore.value },
  ),
  setGenericPassword: jest.fn(async (_user: string, password: string) => {
    if (keychainStore.failWrites) {
      throw new Error('keystore unavailable');
    }
    keychainStore.value = password;
    return true;
  }),
  resetGenericPassword: jest.fn(async () => {
    if (keychainStore.failWrites) {
      throw new Error('keystore unavailable');
    }
    keychainStore.value = null;
    return true;
  }),
}));

import * as pin from './pin';

const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } })
  .process.env;
const workerId = env.JEST_WORKER_ID;

beforeAll(() => {
  delete env.JEST_WORKER_ID;
});

afterAll(() => {
  env.JEST_WORKER_ID = workerId;
});

beforeEach(() => {
  keychainStore.value = null;
  keychainStore.failWrites = false;
  pin.__resetPinMemoryForTests();
});

describe('PIN on the Keychain path', () => {
  it('stores and matches through the Keychain', async () => {
    await pin.storePin('482913');
    expect(keychainStore.value).toContain('"hash"');
    expect(await pin.pinMatches('482913')).toBe(true);
  });

  it('reports a failed write instead of pretending the PIN was saved', async () => {
    keychainStore.failWrites = true;
    await expect(pin.storePin('482913')).rejects.toThrow('pin-store-failed');
    expect(await pin.hasStoredPin()).toBe(false);
  });

  it('a failed change keeps the old PIN working and reports the error', async () => {
    await pin.storePin('111111');
    keychainStore.failWrites = true;
    await expect(pin.storePin('222222')).rejects.toThrow('pin-store-failed');
    expect(await pin.pinMatches('111111')).toBe(true);
    expect(await pin.pinMatches('222222')).toBe(false);
  });

  it('still locks out after repeated failures when the Keychain cannot record them', async () => {
    await pin.storePin('111111');
    keychainStore.failWrites = true;
    let wait = 0;
    for (let i = 0; i < 5; i += 1) {
      wait = await pin.recordPinFailure();
    }
    expect(wait).toBeGreaterThan(0);
    expect(await pin.pinLockRemainingMs()).toBeGreaterThan(0);
  });

  it('records failures in the Keychain when it works', async () => {
    await pin.storePin('111111');
    for (let i = 0; i < 5; i += 1) {
      await pin.recordPinFailure();
    }
    expect(JSON.parse(keychainStore.value!).fails).toBe(5);
    await pin.recordPinSuccess();
    expect(await pin.pinLockRemainingMs()).toBe(0);
  });
});
