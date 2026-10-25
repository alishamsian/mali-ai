import type { CategoryId, Transaction } from '../../types/finance';
import { isExpenseLike, isIncomeLike } from '../insights/analytics';
import { jalaliDayKey, toJalaliYmd, addJalaliMonths } from '../../utils/dates/jalali';

export interface PersonalMonthName {
  title: string;
  subtitle: string;
  kind: 'category' | 'event' | 'income' | 'default';
}

export function transactionsInJalaliMonth(
  transactions: Transaction[],
  year: number,
  month: number,
): Transaction[] {
  return transactions.filter(tx => {
    const p = toJalaliYmd(tx.transactionDate);
    return p.year === year && p.month === month;
  });
}

export function personalMonthName(
  transactions: Transaction[],
  categoryLabel: (id: CategoryId) => string,
  now = new Date(),
): PersonalMonthName {
  const { year, month } = toJalaliYmd(now.toISOString());
  const monthTx = transactionsInJalaliMonth(transactions, year, month);
  if (monthTx.length === 0) {
    return { title: '', subtitle: '', kind: 'default' };
  }

  let income = 0;
  let expense = 0;
  const byCat: Partial<Record<CategoryId, number>> = {};
  let topTx: Transaction | null = null;

  for (const tx of monthTx) {
    if (isIncomeLike(tx)) {
      income += tx.amountRial;
    }
    if (isExpenseLike(tx)) {
      expense += tx.amountRial;
      byCat[tx.categoryId] = (byCat[tx.categoryId] ?? 0) + tx.amountRial;
      if (!topTx || tx.amountRial > topTx.amountRial) {
        topTx = tx;
      }
    }
  }

  if (income > expense * 1.35 && income > 0) {
    return {
      title: 'ماه درآمد',
      subtitle: 'پول وارد شد — خرج را هوشمند نگه دار',
      kind: 'income',
    };
  }

  let topCat: CategoryId | null = null;
  let topCatAmt = 0;
  for (const [id, amt] of Object.entries(byCat) as [CategoryId, number][]) {
    if (amt > topCatAmt) {
      topCatAmt = amt;
      topCat = id;
    }
  }

  if (topCat && topCatAmt > expense * 0.28) {
    const label = categoryLabel(topCat);
    return {
      title: `ماه ${label}`,
      subtitle: `بیشترین سهم خرج: ${label}`,
      kind: 'category',
    };
  }

  if (topTx && topTx.amountRial > expense * 0.22 && topTx.merchant) {
    return {
      title: `ماه ${topTx.merchant}`,
      subtitle: 'یک خرج بزرگ، کل ماه را تعریف کرد',
      kind: 'event',
    };
  }

  return { title: '', subtitle: '', kind: 'default' };
}

export interface MonthClosingStory {
  monthKey: string;
  lines: [string, string, string];
}

export function buildMonthClosingStory(
  transactions: Transaction[],
  now = new Date(),
): MonthClosingStory | null {
  const prevIso = addJalaliMonths(now.toISOString(), -1);
  const { year, month } = toJalaliYmd(prevIso);
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const monthTx = transactionsInJalaliMonth(transactions, year, month);
  const expenses = monthTx.filter(isExpenseLike);
  if (expenses.length < 3) {
    return null;
  }

  const foodOut = expenses.filter(
    tx => tx.categoryId === 'food' || tx.categoryId === 'entertainment',
  ).length;

  let worstAmt = 0;
  const byDay = new Map<string, number>();
  for (const tx of expenses) {
    const k = jalaliDayKey(tx.transactionDate);
    const n = (byDay.get(k) ?? 0) + tx.amountRial;
    byDay.set(k, n);
    if (n > worstAmt) {
      worstAmt = n;
    }
  }

  const line1 =
    foodOut >= 2
      ? `${foodOut} بار بیرون غذا خوردی — یا دلت می‌خواست، یا عجله کردی.`
      : `${expenses.length} خرج ثبت شد — ماهت پر از حرکت بود.`;

  const line2 =
    worstAmt > 0
      ? `سنگین‌ترین روزت ${Math.round(worstAmt / 10_000)}۰ هزار تومان خرج داشت.`
      : 'هیچ روزی خیلی سنگین نبود — آرام و منظم.';

  const line3 = 'ماه بسته شد. ماه تازه، فرصت تازه.';

  return { monthKey, lines: [line1, line2, line3] };
}

export function currentJalaliMonthKey(now = new Date()): string {
  const { year, month } = toJalaliYmd(now.toISOString());
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function shouldOfferMonthClosing(
  transactions: Transaction[],
  lastShownForKey: string | undefined,
  now = new Date(),
): MonthClosingStory | null {
  const { day } = toJalaliYmd(now.toISOString());
  const currentKey = currentJalaliMonthKey(now);
  if (day > 6 || lastShownForKey === currentKey) {
    return null;
  }
  return buildMonthClosingStory(transactions, now);
}
