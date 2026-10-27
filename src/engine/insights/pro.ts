import type { FinanceSnapshot } from '../../database/schema/snapshot';
import type { CategoryId, Transaction } from '../../types/finance';
import { detectRecurring as detectRecurringTransactions } from '../recurring/detect';
import { isExpenseLike, isIncomeLike } from './analytics';
import { financialMonthStart, financialMonthTransactions, type MonthWindowInput } from './monthPeriod';

/** Snapshot fields buildProIntel reads. */
export type ProIntelInput = MonthWindowInput & Pick<FinanceSnapshot, 'profile'>;

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export type VaultGrade = 'A' | 'B' | 'C' | 'D';

export interface RecurringHint {
  merchant: string;
  amountRial: number;
  count: number;
  avgGapDays: number;
  lastDate: string;
  nextDueIso: string;
  daysUntil: number;
}

export interface AnomalyHint {
  id: string;
  merchant: string;
  amountRial: number;
  categoryId: CategoryId;
  ratio: number;
  severity: 'watch' | 'high';
}

export interface ProIntel {
  dayOfMonth: number;
  daysInMonth: number;
  burnPerDayRial: number;
  forecastMonthExpenseRial: number;
  runwayDays: number | null;
  savingsRate: number;
  recurring: RecurringHint[];
  anomalies: AnomalyHint[];
  monthIncomeRial: number;
  monthExpenseRial: number;
  envelopeLeftRial: number;
  paceRatio: number;
  healthScore: number;
  grade: VaultGrade;
  burnSeries: number[];
  weekdaySpend: number[];
  topCategoryId: CategoryId | null;
  topCategoryShare: number;
  volatility: number;
}

export function monthBounds(now = new Date()): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

export function inRange(iso: string, start: Date, end: Date): boolean {
  const t = Date.parse(iso);
  return t >= start.getTime() && t < end.getTime();
}

export function detectRecurring(transactions: Transaction[], userId = 'local'): RecurringHint[] {
  const now = Date.now();
  return detectRecurringTransactions(transactions, userId)
    .map(r => {
      const matching = transactions.filter(
        tx =>
          tx.direction === 'out' &&
          (tx.merchant ?? '') === r.merchant &&
          tx.amountRial === r.amountRial,
      );
      const times = matching.map(tx => Date.parse(tx.transactionDate)).sort((a, b) => a - b);
      const gaps: number[] = [];
      for (let i = 1; i < times.length; i += 1) {
        gaps.push((times[i] - times[i - 1]) / 86400000);
      }
      const avgGapDays = gaps.length
        ? Math.round(gaps.reduce((s, n) => s + n, 0) / gaps.length)
        : 30;
      const lastDate = matching[matching.length - 1]?.transactionDate ?? r.nextExpectedDate;
      return {
        merchant: r.merchant,
        amountRial: r.amountRial,
        count: matching.length,
        avgGapDays,
        lastDate,
        nextDueIso: r.nextExpectedDate,
        daysUntil: Math.round((Date.parse(r.nextExpectedDate) - now) / 86400000),
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

export function detectAnomalies(transactions: Transaction[]): AnomalyHint[] {
  const expenses = [...transactions.filter(isExpenseLike)].sort((a, b) =>
    b.transactionDate.localeCompare(a.transactionDate),
  );
  const byCat = new Map<CategoryId, number[]>();
  for (const tx of expenses) {
    const arr = byCat.get(tx.categoryId) ?? [];
    arr.push(tx.amountRial);
    byCat.set(tx.categoryId, arr);
  }
  const out: AnomalyHint[] = [];
  for (const tx of expenses.slice(0, 20)) {
    const peers = (byCat.get(tx.categoryId) ?? []).filter(n => n !== tx.amountRial).slice(0, 12);
    const med = median(peers);
    if (med <= 0 || tx.amountRial < med * 2.2) {
      continue;
    }
    if (tx.amountRial < 2_000_000) {
      continue;
    }
    out.push({
      id: tx.id,
      merchant: tx.merchant ?? tx.categoryId,
      amountRial: tx.amountRial,
      categoryId: tx.categoryId,
      ratio: Number((tx.amountRial / med).toFixed(1)),
      severity: tx.amountRial / med >= 3.5 ? 'high' : 'watch',
    });
  }
  return out.slice(0, 4);
}

export function vaultGrade(score: number): VaultGrade {
  if (score >= 80) {
    return 'A';
  }
  if (score >= 65) {
    return 'B';
  }
  if (score >= 48) {
    return 'C';
  }
  return 'D';
}

export function computeHealthScore(input: {
  savingsRate: number;
  runwayDays: number | null;
  paceRatio: number;
  anomalyCount: number;
  topShare: number;
}): number {
  let score = 42;
  if (input.savingsRate >= 0.25) {
    score += 28;
  } else if (input.savingsRate >= 0.1) {
    score += 18;
  } else if (input.savingsRate >= 0) {
    score += 10;
  } else if (input.savingsRate < -0.15) {
    score -= 16;
  }
  if (input.runwayDays == null) {
    score += 8;
  } else if (input.runwayDays >= 90) {
    score += 22;
  } else if (input.runwayDays >= 30) {
    score += 14;
  } else if (input.runwayDays >= 14) {
    score += 6;
  } else {
    score -= 10;
  }
  if (input.paceRatio > 1.25) {
    score -= 14;
  } else if (input.paceRatio > 1.08) {
    score -= 6;
  } else if (input.paceRatio > 0 && input.paceRatio < 0.9) {
    score += 8;
  }
  score -= Math.min(18, input.anomalyCount * 6);
  if (input.topShare >= 0.55) {
    score -= 8;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

function iranWeekday(d: Date): number {
  return (d.getDay() + 1) % 7;
}

function lastNDaySeries(transactions: Transaction[], days: number, now: Date): number[] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - (days - 1));
  const series = Array.from({ length: days }, () => 0);
  for (const tx of transactions.filter(isExpenseLike)) {
    const d = new Date(tx.transactionDate);
    const key = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const idx = Math.round((key.getTime() - start.getTime()) / 86400000);
    if (idx >= 0 && idx < days) {
      series[idx] += tx.amountRial;
    }
  }
  return series;
}

function weekdaySpend(transactions: Transaction[], now: Date): number[] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 27);
  const out = [0, 0, 0, 0, 0, 0, 0];
  for (const tx of transactions.filter(isExpenseLike)) {
    const d = new Date(tx.transactionDate);
    if (d < start) {
      continue;
    }
    out[iranWeekday(d)] += tx.amountRial;
  }
  return out;
}

function resolveMonthWindow(
  transactions: Transaction[],
  snapshot: MonthWindowInput | undefined,
  now: Date,
) {
  if (snapshot) {
    const start = financialMonthStart(snapshot, now, 0);
    const nextStart = financialMonthStart(snapshot, now, 1);
    const prevStart = financialMonthStart(snapshot, now, -1);
    const daysInMonth = Math.max(
      1,
      Math.round((nextStart.getTime() - start.getTime()) / 86400000),
    );
    const dayOfMonth = Math.max(
      1,
      Math.min(daysInMonth, Math.floor((now.getTime() - start.getTime()) / 86400000) + 1),
    );
    const prevDays = Math.max(1, Math.round((start.getTime() - prevStart.getTime()) / 86400000));
    return {
      monthTx: financialMonthTransactions(snapshot, 0, now),
      prevTx: financialMonthTransactions(snapshot, -1, now),
      dayOfMonth,
      daysInMonth,
      prevDays,
    };
  }
  const { start, end } = monthBounds(now);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return {
    monthTx: transactions.filter(t => inRange(t.transactionDate, start, end)),
    prevTx: transactions.filter(t => inRange(t.transactionDate, prevStart, start)),
    dayOfMonth: now.getDate(),
    daysInMonth: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
    prevDays: new Date(now.getFullYear(), now.getMonth(), 0).getDate(),
  };
}

export function buildProIntel(
  transactions: Transaction[],
  totalBalanceRial: number,
  now = new Date(),
  snapshot?: ProIntelInput,
): ProIntel {
  const { monthTx, prevTx, dayOfMonth, daysInMonth, prevDays } = resolveMonthWindow(
    transactions,
    snapshot,
    now,
  );
  const expense = monthTx.filter(isExpenseLike).reduce((s, t) => s + t.amountRial, 0);
  const income = monthTx.filter(isIncomeLike).reduce((s, t) => s + t.amountRial, 0);
  const burnPerDayRial = expense / Math.max(1, dayOfMonth);
  const forecastMonthExpenseRial = Math.round(burnPerDayRial * daysInMonth);
  const runwayDays = burnPerDayRial > 0 ? Math.floor(totalBalanceRial / burnPerDayRial) : null;
  const savingsRate = income === 0 ? 0 : (income - expense) / income;
  const prevExpense = prevTx.filter(isExpenseLike).reduce((s, t) => s + t.amountRial, 0);
  const prevDaily = prevExpense / Math.max(1, prevDays);
  const expectedMtd = prevDaily > 0 ? prevDaily * dayOfMonth : expense;
  const paceRatio = expectedMtd > 0 ? expense / expectedMtd : 1;
  const byCat = new Map<CategoryId, number>();
  for (const tx of monthTx.filter(isExpenseLike)) {
    byCat.set(tx.categoryId, (byCat.get(tx.categoryId) ?? 0) + tx.amountRial);
  }
  const top = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];
  const topCategoryShare = expense > 0 && top ? top[1] / expense : 0;
  const burnSeries = lastNDaySeries(transactions, 14, now);
  const mean = burnSeries.reduce((s, n) => s + n, 0) / Math.max(1, burnSeries.length);
  const variance = burnSeries.reduce((s, n) => s + (n - mean) ** 2, 0) / Math.max(1, burnSeries.length);
  const volatility = mean > 0 ? Math.sqrt(variance) / mean : 0;
  const recurring = detectRecurring(transactions, snapshot?.profile.id ?? 'local');
  const anomalies = detectAnomalies(transactions);
  const healthScore = computeHealthScore({
    savingsRate,
    runwayDays,
    paceRatio,
    anomalyCount: anomalies.length,
    topShare: topCategoryShare,
  });
  return {
    dayOfMonth,
    daysInMonth,
    burnPerDayRial: Math.round(burnPerDayRial),
    forecastMonthExpenseRial,
    runwayDays,
    savingsRate,
    recurring,
    anomalies,
    monthIncomeRial: income,
    monthExpenseRial: expense,
    envelopeLeftRial: income - expense,
    paceRatio: Number(paceRatio.toFixed(2)),
    healthScore,
    grade: vaultGrade(healthScore),
    burnSeries,
    weekdaySpend: weekdaySpend(transactions, now),
    topCategoryId: top ? top[0] : null,
    topCategoryShare: Number(topCategoryShare.toFixed(2)),
    volatility: Number(volatility.toFixed(2)),
  };
}

export function dailySpendMap(transactions: Transaction[], year: number, monthIndex: number): Map<string, number> {
  const map = new Map<string, number>();
  for (const tx of transactions.filter(isExpenseLike)) {
    const d = new Date(tx.transactionDate);
    if (d.getFullYear() !== year || d.getMonth() !== monthIndex) {
      continue;
    }
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    map.set(key, (map.get(key) ?? 0) + tx.amountRial);
  }
  return map;
}

export function transactionsToCsv(transactions: Transaction[]): string {
  const header = 'date,type,direction,amount_rial,merchant,category,source,confidence';
  const rows = [...transactions]
    .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))
    .map(tx =>
      [
        tx.transactionDate,
        tx.type,
        tx.direction,
        String(tx.amountRial),
        `"${(tx.merchant ?? '').replace(/"/g, '')}"`,
        tx.categoryId,
        tx.source,
        String(tx.confidence),
      ].join(','),
    );
  return [header, ...rows].join('\n');
}
