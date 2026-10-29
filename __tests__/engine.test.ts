import { tomanToRial, rialToToman, formatTomanFromRial, toInternalRial } from '../src/utils/currency/money';
import { toEnglishDigits, parseIntegerAmount } from '../src/utils/numbers/digits';
import { categorize } from '../src/engine/category/engine';
import { monthlyTotals } from '../src/engine/insights/analytics';
import { detectTransfers, applyTransferLinks } from '../src/engine/transfer/detect';
import { budgetUtilization } from '../src/engine/insights/analytics';
import { detectRecurring } from '../src/engine/recurring/detect';
import { findCrossSourceDuplicate } from '../src/engine/duplicate/crossSource';
import { budgetAlerts } from '../src/engine/budget/alerts';
import type { Transaction } from '../src/types/finance';

const base = (over: Partial<Transaction>): Transaction => ({
  id: 'x',
  userId: 'u',
  accountId: 'a',
  type: 'purchase',
  direction: 'out',
  amountRial: 1000,
  currency: 'IRR',
  categoryId: 'other',
  transactionDate: '2026-08-01T10:00:00.000Z',
  source: 'manual',
  fingerprint: 'f',
  confidence: 1,
  isConfirmed: true,
  needsReview: false,
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
  ...over,
});

describe('currency', () => {
  it('uses integer rials', () => {
    expect(tomanToRial(125_000)).toBe(1_250_000);
    expect(rialToToman(1_250_000)).toBe(125_000);
    expect(toInternalRial(125000, 'IRT')).toBe(1_250_000);
  });

  it('formats Persian grouped toman', () => {
    expect(formatTomanFromRial(784_500_000)).toMatch(/۷۸/);
  });

  it('parses mixed digits', () => {
    expect(parseIntegerAmount(toEnglishDigits('۱,۲۵۰,۰۰۰'))).toBe(1250000);
  });
});

describe('daily ledger', () => {
  it('sums income and expense per jalali day', () => {
    const { jalaliDayKey } = require('../src/utils/dates/jalali');
    const { summarizeDay } = require('../src/engine/insights/dailyLedger');
    const txDate = '2026-08-25T09:00:00.000Z';
    const key = jalaliDayKey(txDate);
    const txs = [
      base({ id: '1', direction: 'in', type: 'deposit', amountRial: 500_000, transactionDate: txDate }),
      base({ id: '2', direction: 'out', type: 'purchase', amountRial: 200_000, transactionDate: '2026-08-25T20:00:00.000Z' }),
      base({ id: '3', direction: 'out', type: 'purchase', amountRial: 100_000, transactionDate: '2026-08-20T20:00:00.000Z' }),
    ];
    const s = summarizeDay(txs, key);
    expect(s.incomeRial).toBe(500_000);
    expect(s.expenseRial).toBe(200_000);
    expect(s.netRial).toBe(300_000);
    expect(s.txCount).toBe(2);
  });

  it('excludes transfers from net', () => {
    const { jalaliDayKey } = require('../src/utils/dates/jalali');
    const { summarizeDay } = require('../src/engine/insights/dailyLedger');
    const txDate = '2026-08-25T12:00:00.000Z';
    const key = jalaliDayKey(txDate);
    const txs = [
      base({ id: '1', direction: 'out', type: 'transfer', transferId: 'own', amountRial: 1_000_000, transactionDate: txDate }),
      base({ id: '2', direction: 'out', type: 'purchase', amountRial: 50_000, transactionDate: '2026-08-25T13:00:00.000Z' }),
    ];
    const s = summarizeDay(txs, key);
    expect(s.transferRial).toBe(1_000_000);
    expect(s.expenseRial).toBe(50_000);
    expect(s.netRial).toBe(-50_000);
  });
});
describe('category engine', () => {
  it('maps known merchants', () => {
    expect(categorize({ merchant: 'دیجی‌کالا' })).toBe('shopping');
    expect(categorize({ merchant: 'اسنپ' })).toBe('transport');
    expect(categorize({ merchant: 'Spotify' })).toBe('subscriptions');
  });

  it('learns from user correction', () => {
    expect(
      categorize({
        merchant: 'کافه X',
        userRules: [{ id: '1', userId: 'u', matcher: 'کافه X', categoryId: 'food', createdAt: '' }],
      }),
    ).toBe('food');
  });
});

describe('financial engine', () => {
  it('excludes transfers from expense/income', () => {
    const txs: Transaction[] = [
      base({ id: '1', accountId: 'a', direction: 'out', amountRial: 10_000_000, type: 'withdrawal' }),
      base({
        id: '2',
        accountId: 'b',
        direction: 'in',
        amountRial: 10_000_000,
        type: 'deposit',
        categoryId: 'income',
      }),
    ];
    const links = detectTransfers(txs, 'u');
    const linked = applyTransferLinks(txs, links);
    const snap = monthlyTotals(linked);
    expect(links).toHaveLength(1);
    expect(snap.expenseRial).toBe(0);
    expect(snap.incomeRial).toBe(0);
    expect(snap.transferRial).toBe(10_000_000);
  });

  it('computes budget utilization', () => {
    expect(budgetUtilization(7, 10)).toBeCloseTo(0.7);
  });

  it('detects recurring merchants', () => {
    const txs = [
      base({ id: '1', merchant: 'Spotify', amountRial: 150000, transactionDate: '2026-06-01T00:00:00.000Z' }),
      base({ id: '2', merchant: 'Spotify', amountRial: 150000, transactionDate: '2026-07-01T00:00:00.000Z' }),
    ];
    expect(detectRecurring(txs, 'u').length).toBe(1);
  });
});

describe('cross-source duplicates', () => {
  it('matches manual and SMS of the same amount within two days', () => {
    const manual = base({
      id: 'm1',
      source: 'manual',
      amountRial: 1_250_000,
      merchant: 'فروشگاه',
      transactionDate: '2026-08-25T10:00:00.000Z',
    });
    const sms = base({
      id: 's1',
      source: 'android_sms',
      amountRial: 1_250_000,
      merchant: 'فروشگاه',
      transactionDate: '2026-08-25T12:00:00.000Z',
    });
    expect(findCrossSourceDuplicate([manual], sms)?.id).toBe('m1');
  });
});

describe('budget alerts', () => {
  it('warns at 80 percent of a category limit', () => {
    const now = new Date('2026-08-20T12:00:00.000Z');
    const alerts = budgetAlerts(
      {
        settings: { budgetAlertsEnabled: true },
        budgetCategories: [
          { id: '1', budgetId: 'b', categoryId: 'food', limitRial: 1_000_000 },
        ],
        transactions: [
          base({
            amountRial: 800_000,
            categoryId: 'food',
            transactionDate: '2026-08-10T10:00:00.000Z',
          }),
        ],
      },
      now,
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].ratio).toBeCloseTo(0.8);
  });
});
