import { isNewerVersion } from './checkForUpdate';

describe('isNewerVersion', () => {
  it('compares dotted versions numerically', () => {
    expect(isNewerVersion('1.10.0', '1.9.3')).toBe(true);
    expect(isNewerVersion('1.18.0', '1.18.0')).toBe(false);
    expect(isNewerVersion('1.17.9', '1.18.0')).toBe(false);
    expect(isNewerVersion('beta', '1.0.0')).toBe(false);
  });
});
