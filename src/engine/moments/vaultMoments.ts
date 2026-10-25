import type { FinanceSnapshot } from '../../database/schema/snapshot';
import type { CategoryId, Transaction } from '../../types/finance';
import { addJalaliMonths } from '../../utils/dates/jalali';
import { jalaliDayKey, todayJalaliKey, toJalaliYmd } from '../../utils/dates/jalali';
import { isExpenseLike } from '../insights/analytics';
import { summarizeDay } from '../insights/dailyLedger';

export type VaultLevel = 'none' | 'bronze' | 'silver' | 'gold';

export function computeVaultLevel(snapshot: FinanceSnapshot): VaultLevel {
  const sms = snapshot.settings.smsProcessingEnabled;
  if (!sms) {
    return 'none';
  }
  const hasBudget =
    snapshot.budgets.length > 0 &&
    snapshot.budgetCategories.some(bc => bc.limitRial > 0);
  if (hasBudget) {
    return 'gold';
  }

  const review =
    snapshot.transactions.filter(t => t.needsReview).length + snapshot.unknownSms.length;
  const since = Date.now() - 30 * 86_400_000;
  const smsRecent = snapshot.transactions.some(
    t => t.source === 'android_sms' && Date.parse(t.transactionDate) >= since,
  );
  if (review === 0 && smsRecent) {
    return 'silver';
  }
  return 'bronze';
}

export function vaultLevelLabel(level: VaultLevel): string {
  switch (level) {
    case 'bronze':
      return 'برنز';
    case 'silver':
      return 'نقره';
    case 'gold':
      return 'طلا';
    default:
      return '';
  }
}

const OCCASION_WINDOWS: Array<{
  id: string;
  month: number;
  dayFrom: number;
  dayTo: number;
  name: string;
}> = [
  { id: 'nowruz', month: 1, dayFrom: 1, dayTo: 14, name: 'نوروز' },
  { id: 'yalda', month: 9, dayFrom: 28, dayTo: 30, name: 'یلدا' },
  { id: 'school', month: 7, dayFrom: 1, dayTo: 10, name: 'مدرسه' },
  { id: 'moharram', month: 6, dayFrom: 1, dayTo: 20, name: 'محرم' },
];

export function occasionSpendHint(
  transactions: Transaction[],
  now = new Date(),
): { title: string; body: string } | null {
  const { month, day } = toJalaliYmd(now.toISOString());
  const hit = OCCASION_WINDOWS.find(w => w.month === month && day >= w.dayFrom && day <= w.dayTo);
  if (!hit) {
    return null;
  }

  let weekSum = 0;
  for (let i = 0; i < 7; i++) {
    const k = jalaliDayKey(new Date(Date.now() - i * 86_400_000).toISOString());
    weekSum += summarizeDay(transactions, k).expenseRial;
  }
  let priorSum = 0;
  for (let i = 7; i < 28; i++) {
    const k = jalaliDayKey(new Date(Date.now() - i * 86_400_000).toISOString());
    priorSum += summarizeDay(transactions, k).expenseRial;
  }
  const weekAvg = weekSum / 7;
  const priorAvg = priorSum / 21;
  if (priorAvg <= 0) {
    return {
      title: `فصل ${hit.name}`,
      body: 'این روزها معمولاً خرج‌ها بالا می‌رود — آماده‌ای؟',
    };
  }
  const pct = Math.round(((weekAvg - priorAvg) / priorAvg) * 100);
  if (pct >= 12) {
    return {
      title: `فصل ${hit.name}`,
      body: `این هفته خرجت حدود ${pct}٪ بیشتر از میانگین سه هفته قبل است.`,
    };
  }
  return {
    title: `فصل ${hit.name}`,
    body: 'معمولاً این هفته خرجت بالا می‌رود — با نگاه باز ادامه بده.',
  };
}

export function zeroDayMoment(
  transactions: Transaction[],
  now = new Date(),
): { dayKey: string; title: string; body: string } | null {
  const yesterday = jalaliDayKey(new Date(Date.now() - 86_400_000).toISOString());
  const yExp = summarizeDay(transactions, yesterday).expenseRial;
  if (yExp > 0) {
    return null;
  }
  const { year, month } = toJalaliYmd(now.toISOString());
  const hadOther = transactions.some(tx => {
    if (!isExpenseLike(tx)) {
      return false;
    }
    const p = toJalaliYmd(tx.transactionDate);
    return p.year === year && p.month === month;
  });
  if (!hadOther) {
    return null;
  }
  const todayExp = summarizeDay(transactions, todayJalaliKey()).expenseRial;
  if (todayExp > 0) {
    return null;
  }
  return {
    dayKey: yesterday,
    title: 'روز سکوت مالی',
    body: 'دیروز هیچ خرجی ثبت نشد — سکوت گاهی بهترین پس‌انداز است.',
  };
}

export function firstCalmNightEligible(
  createdAt: string,
  dismissed: boolean,
  now = new Date(),
): boolean {
  if (dismissed) {
    return false;
  }
  const days = (Date.now() - Date.parse(createdAt)) / 86_400_000;
  if (days < 7) {
    return false;
  }
  const hour = now.getHours();
  return hour >= 21 || hour < 6;
}

const FOOD_KW = ['اسنپ', 'snapp', 'غذا', 'رستوران', 'کافه', 'فست', 'پیتزا', 'سوپر', 'هایپر'];

export function moneyTalksLine(transactions: Transaction[]): string | null {
  const month = toJalaliYmd(new Date().toISOString());
  const monthTx = transactions.filter(tx => {
    const p = toJalaliYmd(tx.transactionDate);
    return p.year === month.year && p.month === month.month && isExpenseLike(tx);
  });
  if (monthTx.length < 5) {
    return null;
  }

  const food = monthTx.filter(tx => tx.categoryId === 'food');
  const delivery = food.filter(tx =>
    FOOD_KW.some(k => (tx.merchant ?? tx.description ?? '').toLowerCase().includes(k.toLowerCase())),
  );
  if (delivery.length >= 3) {
    return 'اگر من پول بودم، می‌گفتم: دوباره اسنپ‌فود نه — یخچال هنوز پر است.';
  }

  const subs = monthTx.filter(tx => tx.categoryId === 'subscriptions');
  if (subs.length >= 2) {
    return 'اگر من پول بودم، می‌گفتم: اشتراک‌ها دوباره جان گرفتند — یکی را خاموش کن.';
  }

  const shop = monthTx.filter(tx => tx.categoryId === 'shopping');
  if (shop.length >= 4) {
    return 'اگر من پول بودم، می‌گفتم: خرید احساسی تمام نشده — یک روز مکث کن.';
  }

  const top = [...monthTx].sort((a, b) => b.amountRial - a.amountRial)[0];
  if (top && top.amountRial > 5_000_000) {
    return `اگر من پول بودم، می‌گفتم: آن ${top.merchant ?? 'خرج بزرگ'} را می‌شد به آینده‌ات بدهی.`;
  }

  return 'اگر من پول بودم، می‌گفتم: امروز را ببین، فردا را سبک‌تر کن.';
}

export function pastSelfInsight(
  transactions: Transaction[],
  categoryLabel: (id: CategoryId) => string,
): string | null {
  const now = new Date();
  const cur = toJalaliYmd(now.toISOString());
  const prevYear = cur.year - 1;

  const curFood = sumCategoryMonth(transactions, cur.year, cur.month, 'food');
  const prevFood = sumCategoryMonth(transactions, prevYear, cur.month, 'food');
  if (prevFood > 0 && curFood > 0) {
    const pct = Math.round(((prevFood - curFood) / prevFood) * 100);
    if (pct >= 8) {
      return `تو امسال ${pct}٪ کمتر برای ${categoryLabel('food')} خرج کردی — نسبت به سال قبل.`;
    }
    if (pct <= -8) {
      return `امسال ${Math.abs(pct)}٪ بیشتر ${categoryLabel('food')} خریدی — نسبت به سال قبل.`;
    }
  }

  const pm = toJalaliYmd(addJalaliMonths(now.toISOString(), -1));
  const curExp = sumExpenseMonth(transactions, cur.year, cur.month);
  const prevExp = sumExpenseMonth(transactions, pm.year, pm.month);
  if (prevExp > 0 && curExp > 0) {
    const pct = Math.round(((prevExp - curExp) / prevExp) * 100);
    if (Math.abs(pct) >= 10) {
      return pct > 0
        ? `این ماه ${pct}٪ کمتر از ماه قبل خرج کردی — رشد شخصی واقعی.`
        : `این ماه ${Math.abs(pct)}٪ بیشتر خرج شده — شاید فصلش بوده.`;
    }
  }
  return null;
}

function sumCategoryMonth(
  transactions: Transaction[],
  year: number,
  month: number,
  cat: CategoryId,
): number {
  return transactions
    .filter(tx => {
      const p = toJalaliYmd(tx.transactionDate);
      return p.year === year && p.month === month && isExpenseLike(tx) && tx.categoryId === cat;
    })
    .reduce((s, t) => s + t.amountRial, 0);
}

function sumExpenseMonth(transactions: Transaction[], year: number, month: number): number {
  return transactions
    .filter(tx => {
      const p = toJalaliYmd(tx.transactionDate);
      return p.year === year && p.month === month && isExpenseLike(tx);
    })
    .reduce((s, t) => s + t.amountRial, 0);
}
