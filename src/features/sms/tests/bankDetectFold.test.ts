import { detectBank } from '../detectors/bankDetector';

const detect = (body: string) =>
  detectBank({ sender: 'unknown', body, receivedAt: '2026-10-01T10:00:00Z', originalLength: body.length });

describe('bank detection by name', () => {
  it('matches bank names written with Arabic ي and ك', () => {
    expect(detect('بانك صادرات ايران\nبرداشت 120000\nمانده 900000').bankId).toBe('saderat');
    expect(detect('بانک تجارت\nبرداشت 120000\nمانده 900000').bankId).toBe('tejarat');
  });
});
