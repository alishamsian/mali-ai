import { isoForJalaliDayKey, jalaliDayKey, shiftJalaliDayKey, jalaliDayLabel } from './jalali';

// Exercise the installed calendar implementation, not the suite's Gregorian stub.
jest.mock('jalaliday', () =>
  jest.requireActual('../../../node_modules/jalaliday/src/dayjs/plugin.ts'),
);

const dates = [
  ['1405-08-10', '2026-11-01'],
  ['1405-12-29', '2027-03-20'],
  ['1404-12-29', '2026-03-20'],
  ['1403-12-30', '2025-03-20'],
  ['1404-01-01', '2025-03-21'],
  ['1405-06-31', '2026-09-22'],
  ['1405-07-30', '2026-10-22'],
  ['1405-08-01', '2026-10-23'],
];

afterEach(() => jest.useRealTimers());
describe.each(['2026-10-31', '2026-03-31', '2026-02-28'])(
  'calendar conversion anchored on %s',
  today => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(`${today}T12:00:00+03:30`));
    });
    test.each(dates)('%s round-trips at local noon on %s', (key, gregorian) => {
      const iso = isoForJalaliDayKey(key);
      expect(iso).toBe(`${gregorian}T08:30:00.000Z`);
      expect(jalaliDayKey(iso)).toBe(key);
    });
  },
);
test.each([
  ['1405-08-09', 1, '1405-08-10'],
  ['1405-08-10', 1, '1405-08-11'],
  ['1405-07-30', 1, '1405-08-01'],
  ['1405-01-01', -1, '1404-12-29'],
  ['1403-12-30', 1, '1404-01-01'],
  ['1405-06-31', 1, '1405-07-01'],
])('shifting %s by %i days gives %s', (key, offset, expected) => {
  expect(shiftJalaliDayKey(key, offset)).toBe(expected);
});
test('labels do not slip into the next month', () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-31T12:00:00+03:30'));
  expect(jalaliDayLabel('1405-08-10')).toBe('۱۰ آبان ۱۴۰۵');
});
