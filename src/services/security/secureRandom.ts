/**
 * CSPRNG bytes only. `crypto.getRandomValues` is installed on Hermes by
 * `react-native-get-random-values` (imported first in index.js).
 * Never falls back to Math.random — keys and salts must be unpredictable.
 */
export class SecureRandomUnavailableError extends Error {
  constructor() {
    super('secure-random-unavailable');
    this.name = 'SecureRandomUnavailableError';
  }
}

export function secureRandomBytes(length: number): Uint8Array {
  const cryptoObj = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => void } })
    .crypto;
  if (!cryptoObj?.getRandomValues) {
    throw new SecureRandomUnavailableError();
  }
  const bytes = new Uint8Array(length);
  cryptoObj.getRandomValues(bytes);
  return bytes;
}

export function secureRandomHex(length: number): string {
  return Array.from(secureRandomBytes(length), b => b.toString(16).padStart(2, '0')).join('');
}
