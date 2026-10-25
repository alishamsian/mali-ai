import {
  clearPinHash,
  hasStoredPin,
  pinLooksValid,
  pinMatches,
  storePin,
} from './pin';

describe('pin security', () => {
  beforeEach(async () => {
    await clearPinHash();
  });

  it('validates 6 digit pins only', () => {
    expect(pinLooksValid('123456')).toBe(true);
    expect(pinLooksValid('1234')).toBe(false);
    expect(pinLooksValid('abcd')).toBe(false);
  });

  it('stores and matches pin via local fallback', async () => {
    await storePin('258014');
    expect(await hasStoredPin()).toBe(true);
    expect(await pinMatches('258014')).toBe(true);
    expect(await pinMatches('000000')).toBe(false);
  });
});
