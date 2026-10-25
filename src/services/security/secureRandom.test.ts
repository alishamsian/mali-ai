import { SecureRandomUnavailableError, secureRandomHex } from './secureRandom';

describe('secureRandom', () => {
  it('returns hex of the requested byte length', () => {
    expect(secureRandomHex(16)).toMatch(/^[0-9a-f]{32}$/);
  });

  it('throws instead of falling back to Math.random when crypto is missing', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    try {
      expect(() => secureRandomHex(16)).toThrow(SecureRandomUnavailableError);
    } finally {
      if (original) {
        Object.defineProperty(globalThis, 'crypto', original);
      }
    }
  });
});
