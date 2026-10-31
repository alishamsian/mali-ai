import { detectBanksQuickly } from './historyImport';
import { readSenderSamples } from '../native/SmsModule';

jest.mock('../native/SmsModule', () => ({ readSenderSamples: jest.fn() }));

const melli = 'بانك ملي ايران\nانتقال:1,500,000+\nحساب:61008\nمانده:117,896,079\n0603-19:36';
const sms = (sender: string, body: string) => ({
  sourceSmsId: `${sender}-${body.length}`,
  sender,
  body,
  receivedAt: '2026-10-01T10:00:00Z',
});

test('finds banks from a few samples per sender and estimates the import window from counts', async () => {
  jest.mocked(readSenderSamples).mockResolvedValue([
    // 4 of 5 samples are transactions; 300 messages fall in the import window.
    {
      sender: '9830009417',
      count: 2400,
      recentCount: 300,
      rows: [
        ...Array.from({ length: 4 }, () => sms('9830009417', melli)),
        sms('9830009417', 'رمز پویا: 123456'),
      ],
    },
    { sender: 'Irancell', count: 9000, recentCount: 800, rows: [sms('Irancell', 'بسته فعال شد')] },
  ]);
  const found = await detectBanksQuickly(Date.parse('2026-10-20T10:00:00Z'));
  expect(found.map(f => [f.bankId, f.sender, f.transactionCount])).toEqual([
    ['melli', '9830009417', 240],
  ]);
  // One pass over a year of senders; message bodies beyond the samples never cross over.
  expect(jest.mocked(readSenderSamples).mock.calls[0][0].minDateMs).toBe(
    Date.parse('2026-10-20T10:00:00Z') - 365 * 86_400_000,
  );
});
