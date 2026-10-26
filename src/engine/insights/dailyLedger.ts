import type {
  BudgetCategory,
  CategoryId,
  Transaction,
  TransactionSource,
} from '../../types/finance';
import {
  isoForJalaliDayKey,
  jalaliDayKey,
  jalaliMonthMeta,
  shiftJalaliDayKey,
  todayJalaliKey,
} from '../../utils/dates/jalali';
import { isExpenseLike, isIncomeLike } from './analytics';

export type DayGroupBy = 'none' | 'category' | 'account' | 'source';
export type DaySort = 'time_desc' | 'time_asc' | 'amount_desc' | 'amount_asc';
export type DayFilter = 'all' | 'income' | 'expense' | 'transfer' | 'sms';

export interface DayCategorySlice {
  categoryId: CategoryId;
  incomeRial: number;
  expenseRial: number;
}

export interface DayAccountSlice {
  accountId: string;
  incomeRial: number;
  expenseRial: number;
}

export interface DaySummary {
  key: string;
  incomeRial: number;
  expenseRial: number;
  transferRial: number;
  netRial: number;
  txCount: number;
  incomeCount: number;
  expenseCount: number;
  transferCount: number;
  categories: DayCategorySlice[];
  accounts: DayAccountSlice[];
  sources: Partial<Record<TransactionSource, number>>;
}

/** @deprecated use jalaliDayKey — kept for tests importing dayKeyLocal */
export function dayKeyLocal(iso: string | Date): string {
  return jalaliDayKey(iso);
}

export function todayKey(): string {
  return todayJalaliKey();
}

export function shiftDayKey(key: string, delta: number): string {
  return shiftJalaliDayKey(key, delta);
}

export function isoAtLocalNoon(key: string): string {
  return isoForJalaliDayKey(key);
}

function isTransferLike(tx: Transaction): boolean {
  return tx.type === 'transfer' || Boolean(tx.transferId);
}

/** Day index per transactions array; the store replaces the array on every change, so it never goes stale. */
const dayIndexCache = new WeakMap<Transaction[], Map<string, Transaction[]>>();

function dayIndex(transactions: Transaction[]): Map<string, Transaction[]> {
  let index = dayIndexCache.get(transactions);
  if (!index) {
    index = new Map();
    for (const tx of transactions) {
      const key = jalaliDayKey(tx.transactionDate);
      const bucket = index.get(key);
      if (bucket) {
        bucket.push(tx);
      } else {
        index.set(key, [tx]);
      }
    }
    dayIndexCache.set(transactions, index);
  }
  return index;
}

export function transactionsForDay(transactions: Transaction[], key: string): Transaction[] {
  return dayIndex(transactions).get(key) ?? [];
}

export function filterDayTransactions(
  transactions: Transaction[],
  filter: DayFilter,
): Transaction[] {
  if (filter === 'all') {
    return transactions;
  }
  if (filter === 'income') {
    return transactions.filter(isIncomeLike);
  }
  if (filter === 'expense') {
    return transactions.filter(isExpenseLike);
  }
  if (filter === 'sms') {
    return transactions.filter(tx => tx.source === 'android_sms');
  }
  return transactions.filter(isTransferLike);
}

export function sortDayTransactions(transactions: Transaction[], sort: DaySort): Transaction[] {
  const list = [...transactions];
  if (sort === 'time_desc') {
    return list.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  }
  if (sort === 'time_asc') {
    return list.sort((a, b) => a.transactionDate.localeCompare(b.transactionDate));
  }
  if (sort === 'amount_desc') {
    return list.sort((a, b) => b.amountRial - a.amountRial);
  }
  return list.sort((a, b) => a.amountRial - b.amountRial);
}

export function summarizeDay(transactions: Transaction[], key: string): DaySummary {
  const dayTx = transactionsForDay(transactions, key);
  let incomeRial = 0;
  let expenseRial = 0;
  let transferRial = 0;
  let incomeCount = 0;
  let expenseCount = 0;
  let transferCount = 0;
  const catMap = new Map<CategoryId, { incomeRial: number; expenseRial: number }>();
  const accMap = new Map<string, { incomeRial: number; expenseRial: number }>();
  const sources: Partial<Record<TransactionSource, number>> = {};

  for (const tx of dayTx) {
    sources[tx.source] = (sources[tx.source] ?? 0) + tx.amountRial;
    if (isIncomeLike(tx)) {
      incomeRial += tx.amountRial;
      incomeCount += 1;
      const c = catMap.get(tx.categoryId) ?? { incomeRial: 0, expenseRial: 0 };
      c.incomeRial += tx.amountRial;
      catMap.set(tx.categoryId, c);
      const a = accMap.get(tx.accountId) ?? { incomeRial: 0, expenseRial: 0 };
      a.incomeRial += tx.amountRial;
      accMap.set(tx.accountId, a);
    } else if (isExpenseLike(tx)) {
      expenseRial += tx.amountRial;
      expenseCount += 1;
      const c = catMap.get(tx.categoryId) ?? { incomeRial: 0, expenseRial: 0 };
      c.expenseRial += tx.amountRial;
      catMap.set(tx.categoryId, c);
      const a = accMap.get(tx.accountId) ?? { incomeRial: 0, expenseRial: 0 };
      a.expenseRial += tx.amountRial;
      accMap.set(tx.accountId, a);
    } else if (isTransferLike(tx)) {
      if (tx.direction === 'out' || tx.type === 'transfer') {
        transferRial += tx.amountRial;
      }
      transferCount += 1;
    }
  }

  const categories = [...catMap.entries()]
    .map(([categoryId, v]) => ({ categoryId, ...v }))
    .sort((a, b) => b.expenseRial + b.incomeRial - (a.expenseRial + a.incomeRial));

  const accounts = [...accMap.entries()]
    .map(([accountId, v]) => ({ accountId, ...v }))
    .sort((a, b) => b.expenseRial + b.incomeRial - (a.expenseRial + a.incomeRial));

  return {
    key,
    incomeRial,
    expenseRial,
    transferRial,
    netRial: incomeRial - expenseRial,
    txCount: dayTx.length,
    incomeCount,
    expenseCount,
    transferCount,
    categories,
    accounts,
    sources,
  };
}

export function buildDayRangeSummaries(
  transactions: Transaction[],
  centerKey: string,
  radius: number,
): DaySummary[] {
  return Array.from({ length: radius * 2 + 1 }, (_, i) => {
    const key = shiftJalaliDayKey(centerKey, i - radius);
    return summarizeDay(transactions, key);
  });
}

/** Mean daily expense over the 7 days before `throughKey` (excludes that day). */
export function weekExpenseAverage(transactions: Transaction[], throughKey: string): number {
  let sum = 0;
  for (let i = 1; i <= 7; i++) {
    sum += summarizeDay(transactions, shiftJalaliDayKey(throughKey, -i)).expenseRial;
  }
  return sum / 7;
}

export function monthToDateNet(transactions: Transaction[], throughKey: string): number {
  const [ty, tm, td] = throughKey.split('-').map(Number);
  let net = 0;
  for (const tx of transactions) {
    const k = jalaliDayKey(tx.transactionDate);
    const [y, m, d] = k.split('-').map(Number);
    if (y !== ty || m !== tm) {
      continue;
    }
    if (d > td) {
      continue;
    }
    if (isIncomeLike(tx)) {
      net += tx.amountRial;
    } else if (isExpenseLike(tx)) {
      net -= tx.amountRial;
    }
  }
  return net;
}

export function dayShareText(
  summary: DaySummary,
  label: string,
  formatToman: (rial: number) => string,
  dict: {
    income: string;
    expense: string;
    net: string;
    transfer: string;
    count: string;
  },
): string {
  return [
    label,
    `${dict.income}: ${formatToman(summary.incomeRial)}`,
    `${dict.expense}: ${formatToman(summary.expenseRial)}`,
    `${dict.net}: ${formatToman(summary.netRial)}`,
    summary.transferRial ? `${dict.transfer}: ${formatToman(summary.transferRial)}` : '',
    `${dict.count}: ${summary.txCount}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export interface GroupedDayRows {
  id: string;
  label: string;
  incomeRial: number;
  expenseRial: number;
  transactions: Transaction[];
}

export function groupDayTransactions(
  transactions: Transaction[],
  groupBy: DayGroupBy,
  categoryLabel: (id: CategoryId) => string,
  accountLabel: (id: string) => string,
): GroupedDayRows[] {
  if (groupBy === 'none') {
    return [];
  }
  const map = new Map<string, GroupedDayRows>();
  for (const tx of transactions) {
    let id = 'other';
    let label = '—';
    if (groupBy === 'category') {
      id = tx.categoryId;
      label = categoryLabel(tx.categoryId);
    } else if (groupBy === 'account') {
      id = tx.accountId;
      label = accountLabel(tx.accountId);
    } else {
      id = tx.source;
      label = tx.source;
    }
    const row = map.get(id) ?? { id, label, incomeRial: 0, expenseRial: 0, transactions: [] };
    if (isIncomeLike(tx)) {
      row.incomeRial += tx.amountRial;
    } else if (isExpenseLike(tx)) {
      row.expenseRial += tx.amountRial;
    }
    row.transactions.push(tx);
    map.set(id, row);
  }
  return [...map.values()].sort(
    (a, b) => b.expenseRial + b.incomeRial - (a.expenseRial + a.incomeRial),
  );
}

export function reviewCountForDay(transactions: Transaction[], key: string): number {
  return transactionsForDay(transactions, key).filter(tx => tx.needsReview && !tx.isConfirmed)
    .length;
}

export function expenseSeries(
  transactions: Transaction[],
  throughKey: string,
  days: number,
): number[] {
  const out: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    out.push(summarizeDay(transactions, shiftJalaliDayKey(throughKey, -i)).expenseRial);
  }
  return out;
}

export function dailySpendAllowance(
  transactions: Transaction[],
  budgetCategories: BudgetCategory[],
  dayKey: string,
): { remainingMonthRial: number; dailyAllowanceRial: number; daysLeft: number } | null {
  const totalLimit = budgetCategories.reduce((sum, row) => sum + row.limitRial, 0);
  if (totalLimit <= 0) {
    return null;
  }
  const [y, m, d] = dayKey.split('-').map(Number);
  const meta = jalaliMonthMeta(new Date(isoForJalaliDayKey(dayKey)));
  const daysLeft = Math.max(1, meta.daysInMonth - d + 1);
  let mtdExpense = 0;
  for (const tx of transactions) {
    const k = jalaliDayKey(tx.transactionDate);
    const [ty, tm, td] = k.split('-').map(Number);
    if (ty !== y || tm !== m || td > d) {
      continue;
    }
    if (isExpenseLike(tx)) {
      mtdExpense += tx.amountRial;
    }
  }
  const remainingMonthRial = totalLimit - mtdExpense;
  const dailyAllowanceRial =
    remainingMonthRial <= 0 ? 0 : Math.round(remainingMonthRial / daysLeft);
  return { remainingMonthRial, dailyAllowanceRial, daysLeft };
}

export function dayInsightLine(
  summary: DaySummary,
  yesterday: DaySummary,
  isToday: boolean,
  weekAvg: number | null,
): {
  code: 'weekMore' | 'weekLess' | 'weekFlat' | 'yesterdayUp' | 'yesterdayDown' | 'yesterdayFlat';
  vars: Record<string, string | number>;
} | null {
  if (isToday && weekAvg != null && weekAvg > 0 && summary.expenseRial > 0) {
    const delta = summary.expenseRial - weekAvg;
    if (Math.abs(delta) < weekAvg * 0.05) {
      return { code: 'weekFlat', vars: {} };
    }
    return {
      code: delta > 0 ? 'weekMore' : 'weekLess',
      vars: { amount: Math.abs(delta) },
    };
  }
  if (yesterday.expenseRial <= 0 && summary.expenseRial <= 0) {
    return null;
  }
  if (yesterday.expenseRial <= 0) {
    return summary.expenseRial > 0 ? { code: 'yesterdayUp', vars: { pct: 100 } } : null;
  }
  const pct = ((summary.expenseRial - yesterday.expenseRial) / yesterday.expenseRial) * 100;
  if (Math.abs(pct) < 3) {
    return { code: 'yesterdayFlat', vars: {} };
  }
  return {
    code: pct > 0 ? 'yesterdayUp' : 'yesterdayDown',
    vars: { pct: Math.round(Math.abs(pct)) },
  };
}
