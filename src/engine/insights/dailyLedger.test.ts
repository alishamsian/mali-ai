import {
  dailySpendAllowance,
  dayInsightLine,
  dayShareText,
  expenseSeries,
  filterDayTransactions,
  monthToDateNet,
  sortDayTransactions,
  summarizeDay,
} from './dailyLedger';
import { monthlyTotals } from './analytics';
import { emptySnapshot } from '../../database/schema/snapshot';
import { flowKindForTransaction } from '../../components/ui/FlowAmount';
import { fa } from '../../i18n/fa';
import type { Transaction } from '../../types/finance';
jest.mock('jalaliday', () =>
  jest.requireActual('../../../node_modules/jalaliday/src/dayjs/plugin.ts'),
);
const date = '2026-10-31T10:00:00+03:30';
const key = '1405-08-09';
const now = new Date('2026-10-31T16:00:00+03:30');
const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: 'spend',
  userId: 'u',
  accountId: 'a',
  type: 'purchase',
  direction: 'out',
  amountRial: 1_000_000,
  currency: 'IRR',
  categoryId: 'food',
  transactionDate: date,
  source: 'manual',
  fingerprint: 'test',
  confidence: 1,
  isConfirmed: true,
  needsReview: false,
  createdAt: date,
  updatedAt: date,
  ...over,
});

test.each(['refund', 'reversal'] as const)('%s lowers expense and is not income', type => {
  const data = [tx(), tx({ id: 'refund', type, direction: 'in', amountRial: 200_000 })];
  const day = summarizeDay(data, key);
  expect(day.expenseRial).toBe(monthlyTotals(data).expenseRial);
  expect(day.netRial).toBe(-800_000);
  expect(day.refundRial).toBe(200_000);
  expect(day.incomeRial).toBe(0);
  expect(day.categories[0].expenseRial).toBe(800_000);
  expect(expenseSeries(data, key, 2)).toEqual([0, 800_000]);
  expect(filterDayTransactions(data, 'expense')).toHaveLength(2);
  expect(filterDayTransactions(data, 'income')).toHaveLength(0);
});
test('a refund-only day keeps positive cash flow without negative expense or invented income', () => {
  const day = summarizeDay([tx({ type: 'refund', direction: 'in' })], key);
  expect(day).toMatchObject({
    expenseRial: 0,
    incomeRial: 0,
    netRial: 1_000_000,
    refundRial: 1_000_000,
  });
});
test('both typed legs of one transfer count once and never change the net', () => {
  const data = [
    tx({ transferId: 'own', type: 'transfer', direction: 'out' }),
    tx({ id: 'in', transferId: 'own', type: 'transfer', direction: 'in' }),
  ];
  expect(summarizeDay(data, key)).toMatchObject({
    transferRial: monthlyTotals(data).transferRial,
    transferCount: 1,
    expenseRial: 0,
    incomeRial: 0,
    netRial: 0,
  });
});
test('external card payments are expenses, while standalone internal moves are transfers', () => {
  const external = tx({ type: 'transfer' });
  const internal = tx({ id: 'internal', type: 'transfer', direction: 'internal' });
  expect(filterDayTransactions([external, internal], 'transfer')).toEqual([internal]);
  expect(flowKindForTransaction(external)).toBe('expense');
  expect(flowKindForTransaction(internal)).toBe('neutral');
  expect(summarizeDay([external, internal], key)).toMatchObject({
    expenseRial: 1_000_000,
    transferRial: 1_000_000,
    netRial: -1_000_000,
  });
});
test('a zero baseline never produces a made-up 100% increase', () => {
  expect(dayInsightLine(summarizeDay([tx()], key), summarizeDay([], key), false, null)).toBeNull();
});
test('ordering compares instants, including ISO strings with different offsets', () => {
  const earlier = tx({ id: 'earlier', transactionDate: '2026-10-31T10:00:00+03:30' });
  const later = tx({ id: 'later', transactionDate: '2026-10-31T07:00:00Z' });
  expect(sortDayTransactions([earlier, later], 'time_desc').map(t => t.id)).toEqual([
    'later',
    'earlier',
  ]);
});
const shareLabels = {
  income: fa.daily.income,
  expense: fa.daily.expense,
  net: fa.daily.cashFlow,
  transfer: fa.daily.ownTransfers,
  count: fa.daily.txCount,
  refund: fa.daily.refund,
};
test.each(['IRT', 'IRR'] as const)(
  'sharing preserves sign, count, one date and %s unit',
  currency => {
    const text = dayShareText(summarizeDay([tx()], key), '۹ آبان ۱۴۰۵', shareLabels, {
      hidden: false,
      displayCurrency: currency,
    });
    expect(text).toContain('−');
    expect(text).toContain('۱ تراکنش');
    expect(text).not.toContain('{{');
    expect(text.split('۹ آبان ۱۴۰۵')).toHaveLength(2);
    expect(text).toContain(currency === 'IRT' ? 'تومان' : 'ریال');
    expect(text).toContain(currency === 'IRT' ? '۱۰۰,۰۰۰' : '۱,۰۰۰,۰۰۰');
  },
);
test('hidden share payload contains no amount, sign or monetary unit', () => {
  const text = dayShareText(summarizeDay([tx()], key), 'day', shareLabels, {
    hidden: true,
    displayCurrency: 'IRT',
  });
  expect(text).not.toMatch(/۱۰۰,۰۰۰|۱,۰۰۰,۰۰۰|تومان|ریال|−/);
  expect(text).toContain('••••');
});
test('financial month and latest monthly budget govern allowance, including refunds', () => {
  const s = emptySnapshot();
  s.settings.calendar = 'jalali';
  s.settings.financialMonthStartDay = 5;
  s.budgets = [
    {
      id: 'old',
      userId: 'u',
      period: 'monthly',
      year: 2025,
      totalLimitRial: 9000,
      createdAt: '2025-01-01',
    },
    {
      id: 'current',
      userId: 'u',
      period: 'monthly',
      year: 2026,
      totalLimitRial: 1000,
      createdAt: '2026-10-01',
    },
    {
      id: 'yearly',
      userId: 'u',
      period: 'yearly',
      year: 2026,
      totalLimitRial: 90000,
      createdAt: '2026-10-30',
    },
  ];
  s.transactions = [
    tx({ id: 'before', amountRial: 200, transactionDate: '2026-10-26T12:00:00+03:30' }),
    tx({ id: 'spend', amountRial: 300, transactionDate: '2026-10-28T12:00:00+03:30' }),
    tx({
      id: 'refund',
      amountRial: 100,
      type: 'refund',
      direction: 'in',
      transactionDate: '2026-10-30T12:00:00+03:30',
    }),
    tx({ id: 'today', amountRial: 100 }),
    tx({ id: 'future', amountRial: 500, transactionDate: '2026-10-31T18:00:00+03:30' }),
  ];
  expect(dailySpendAllowance(s, key, now)).toEqual({
    remainingMonthRial: 700,
    dailyAllowanceRial: 26,
    daysLeft: 26,
  });
  expect(monthToDateNet(s.transactions, key, s.settings, now)).toBe(-300);
});
test('Gregorian custom financial months also exclude earlier dates and refunds restore net', () => {
  const data = [
    tx({ id: 'before', transactionDate: '2026-10-14T12:00:00+03:30' }),
    tx({ id: 'inside', transactionDate: '2026-10-16T12:00:00+03:30' }),
    tx({ id: 'refund', type: 'refund', direction: 'in', amountRial: 200_000 }),
  ];
  expect(
    monthToDateNet(data, key, { calendar: 'gregorian', financialMonthStartDay: 15 }, now),
  ).toBe(-800_000);
});
test('without a monthly budget no daily budget is invented', () => {
  expect(dailySpendAllowance(emptySnapshot(), key, now)).toBeNull();
});
