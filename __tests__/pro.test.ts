import {
  buildProIntel,
  computeHealthScore,
  dailySpendMap,
  detectAnomalies,
  detectRecurring,
  transactionsToCsv,
  vaultGrade,
} from '../src/engine/insights/pro';
import { dailyBrief } from '../src/engine/insights/dailyBrief';
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

describe('pro insights', () => {
  it('forecasts month burn from month-to-date spend', () => {
    const now = new Date(2026, 7, 10);
    const txs = [
      base({ id: '1', amountRial: 1_000_000, transactionDate: '2026-08-02T12:00:00.000Z' }),
      base({ id: '2', amountRial: 1_000_000, transactionDate: '2026-08-04T12:00:00.000Z' }),
    ];
    const intel = buildProIntel(txs, 31_000_000, now);
    expect(intel.dayOfMonth).toBe(10);
    expect(intel.burnPerDayRial).toBe(200_000);
    expect(intel.forecastMonthExpenseRial).toBe(200_000 * 31);
    expect(intel.runwayDays).toBe(155);
  });

  it('detects near-monthly recurring merchants', () => {
    const txs = [0, 28, 56].map((days, i) =>
      base({
        id: `r${i}`,
        merchant: 'نت‌فلیکس',
        amountRial: 1_200_000,
        categoryId: 'subscriptions',
        transactionDate: new Date(2026, 0, 5 + days, 12).toISOString(),
      }),
    );
    const hints = detectRecurring(txs);
    expect(hints).toHaveLength(1);
    expect(hints[0].merchant).toBe('نت‌فلیکس');
    expect(hints[0].count).toBe(3);
  });

  it('flags category outliers above median and 2M rials', () => {
    const txs = [
      ...[1, 2, 3, 4].map(i =>
        base({
          id: `s${i}`,
          amountRial: 500_000,
          categoryId: 'food',
          merchant: 'کافه',
          transactionDate: `2026-08-0${i}T10:00:00.000Z`,
        }),
      ),
      base({
        id: 'big',
        amountRial: 5_000_000,
        categoryId: 'food',
        merchant: 'رستوران',
        transactionDate: '2026-08-20T10:00:00.000Z',
      }),
    ];
    const anomalies = detectAnomalies(txs);
    expect(anomalies.some(a => a.id === 'big')).toBe(true);
  });

  it('maps daily spend on local calendar keys', () => {
    const txs = [base({ amountRial: 3_000_000, transactionDate: new Date(2026, 7, 12, 18).toISOString() })];
    const map = dailySpendMap(txs, 2026, 7);
    expect(map.get('2026-08-12')).toBe(3_000_000);
  });

  it('exports csv with header', () => {
    const csv = transactionsToCsv([base({ merchant: 'آزمایش', amountRial: 10 })]);
    expect(csv.startsWith('date,type,direction,amount_rial')).toBe(true);
    expect(csv).toContain('آزمایش');
  });

  it('paces month-to-date against previous month daily burn', () => {
    const now = new Date(2026, 7, 10);
    const txs = [
      base({ id: 'p', amountRial: 3_100_000, transactionDate: '2026-07-15T12:00:00.000Z' }),
      base({ id: '1', amountRial: 2_000_000, transactionDate: '2026-08-02T12:00:00.000Z' }),
    ];
    const intel = buildProIntel(txs, 10_000_000, now);
    expect(intel.paceRatio).toBe(2);
    expect(intel.grade).toBeTruthy();
  });

  it('scores vault health into letter grades', () => {
    expect(
      computeHealthScore({
        savingsRate: 0.3,
        runwayDays: 120,
        paceRatio: 0.8,
        anomalyCount: 0,
        topShare: 0.2,
      }),
    ).toBeGreaterThanOrEqual(80);
    expect(vaultGrade(82)).toBe('A');
    expect(vaultGrade(40)).toBe('D');
  });
});

describe('daily brief', () => {
  it('says today is cooler when spend is below yesterday', () => {
    const now = new Date(2026, 7, 25, 16, 0, 0);
    const txs = [
      base({
        id: 'y',
        amountRial: 2_000_000,
        transactionDate: new Date(2026, 7, 24, 12, 0, 0).toISOString(),
      }),
      base({
        id: 't',
        amountRial: 500_000,
        transactionDate: new Date(2026, 7, 25, 12, 0, 0).toISOString(),
      }),
    ];
    const intel = buildProIntel(txs, 10_000_000, now);
    expect(dailyBrief(txs, intel, [], now)?.code).toBe('cooler');
  });

  it('returns null when there are no transactions', () => {
    const now = new Date(2026, 7, 25, 16, 0, 0);
    const intel = buildProIntel([], 0, now);
    expect(dailyBrief([], intel, [], now)).toBeNull();
  });
});
