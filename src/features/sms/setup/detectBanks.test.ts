import { detectBankSenders } from './detectBanks';
import { matchBankIdBySender } from '../registry/senders';

const row = (sender: string, body: string, receivedAt = '2026-10-01T10:00:00Z') => ({
  sender,
  body,
  receivedAt,
});

describe('detectBankSenders', () => {
  it('keeps senders with transaction messages, named by sender or body, biggest first', () => {
    const melli = 'بانك ملي ايران\nانتقال:1,500,000+\nحساب:61008\nمانده:117,896,079\n0603-19:36';
    const found = detectBankSenders([
      row('9830009417', melli),
      row('9830009417', melli.replace('1,500,000', '200,000'), '2026-10-05T10:00:00Z'),
      row('mellat', 'برداشت:250,000-\nحساب:1234\nمانده:9,000,000\n0603-10:00'),
      row('Irancell', 'بسته اینترنت شما فعال شد'),
    ]);
    expect(found.map(f => [f.sender, f.transactionCount])).toEqual([
      ['9830009417', 2],
      ['mellat', 1],
    ]);
    expect(found[0].bankId).toBe('melli');
    expect(found[1].bankId).toBe(matchBankIdBySender('mellat'));
    expect(found[0].lastAt).toBe('2026-10-05T10:00:00Z');
  });
});
