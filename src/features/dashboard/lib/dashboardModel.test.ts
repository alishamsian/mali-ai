import { emptySnapshot } from '../../../database/schema/snapshot';
import type { FinancialAccount, Transaction } from '../../../types/finance';
import { buildDashboardModel } from './dashboardModel';

const now = new Date('2026-10-15T12:00:00Z');
const account = (
  id: string,
  amount: number,
  extra: Partial<FinancialAccount> = {},
): FinancialAccount => ({
  id,
  userId: 'u',
  kind: 'bank',
  name: id,
  balanceRial: amount,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  transactionCount: 0,
  ...extra,
});
const tx = (id: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({
  id,
  userId: 'u',
  accountId: 'bank',
  type: 'purchase',
  direction: 'out',
  amountRial: amount,
  currency: 'IRR',
  categoryId: 'food',
  transactionDate: '2026-10-14T12:00:00Z',
  source: 'manual',
  fingerprint: id,
  confidence: 1,
  isConfirmed: true,
  needsReview: false,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  ...extra,
});
function snapshot() {
  const data = emptySnapshot('u');
  data.settings.calendar = 'gregorian';
  return data;
}

test('total wealth includes gold while cash/bank excludes investments and asset wallets', () => {
  const data = snapshot();
  data.accounts = [
    account('bank', 100),
    account('cash', 20, { kind: 'cash' }),
    account('gold', 500, { kind: 'asset', assetClass: 'gold' }),
    account('crypto', 70, { kind: 'wallet', assetClass: 'crypto' }),
  ];
  expect(buildDashboardModel(data, now)).toMatchObject({ totalAssetsRial: 690, cashRial: 120 });
});

test('an empty or single-observation portfolio never invents growth or a trend chart', () => {
  const data = snapshot();
  expect(buildDashboardModel(data, now)).toMatchObject({
    changePct: null,
    trend: [],
    budgetRatio: null,
    cashRial: 0,
  });
  data.netWorthHistory = [
    { date: '2026-10-14T00:00:00Z', assetsRial: 100, liabilitiesRial: 0, netWorthRial: 100 },
  ];
  expect(buildDashboardModel(data, now)).toMatchObject({ changePct: null, trend: [] });
});

test('growth compares total assets with the same day of last month and ignores future samples', () => {
  const data = snapshot();
  data.accounts = [account('bank', 120)];
  data.netWorthHistory = [
    { date: '2026-09-14T12:00:00Z', assetsRial: 100, liabilitiesRial: 90, netWorthRial: 10 },
    { date: '2026-10-01T00:00:00Z', assetsRial: 105, liabilitiesRial: 90, netWorthRial: 15 },
    { date: '2026-10-14T00:00:00Z', assetsRial: 110, liabilitiesRial: 90, netWorthRial: 20 },
    { date: '2026-11-01T00:00:00Z', assetsRial: 999, liabilitiesRial: 0, netWorthRial: 999 },
  ];
  const model = buildDashboardModel(data, now);
  expect(model.changePct).toBe(20);
  expect(model.trend).toEqual([105, 110, 120]);
});

test('financial month, refunds and own transfers share the existing spending rules', () => {
  const data = snapshot();
  data.settings.financialMonthStartDay = 10;
  data.transactions = [
    tx('old', 500, { transactionDate: '2026-10-09T12:00:00Z' }),
    tx('expense', 200),
    tx('refund', 50, { type: 'refund', direction: 'in' }),
    tx('own', 1000, { transferId: 'own' }),
    tx('future', 999, { transactionDate: '2026-10-16T12:00:00Z' }),
  ];
  const model = buildDashboardModel(data, now);
  expect(model.month.expenseRial).toBe(150);
  expect(model.week.reduce((sum, day) => sum + day.rial, 0)).toBe(650);
  expect(model.recent.some(t => t.id === 'future')).toBe(false);
});

test('budget usage can exceed 100% without changing the actual percentage', () => {
  const data = snapshot();
  data.transactions = [tx('expense', 150)];
  data.budgets = [
    {
      id: 'b',
      userId: 'u',
      period: 'monthly',
      year: 2026,
      month: 10,
      totalLimitRial: 100,
      createdAt: now.toISOString(),
    },
  ];
  expect(buildDashboardModel(data, now).budgetRatio).toBe(1.5);
});
