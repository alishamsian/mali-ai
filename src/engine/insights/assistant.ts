import type { CategoryId } from '../../types/finance';
import type { FinanceSnapshot } from '../../database/schema/snapshot';
import { categoryTotals, isExpenseLike, monthlyTotals } from './analytics';
import { formatTomanLabel } from '../../utils/currency/money';

export function answerFinanceQuestion(
  question: string,
  snapshot: FinanceSnapshot,
  labels: Record<CategoryId, string>,
): string {
  const q = question.trim();
  const month = monthlyTotals(snapshot.transactions);
  const cats = categoryTotals(snapshot.transactions.filter(isExpenseLike));
  const top = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];
  const reviewCount = snapshot.transactions.filter(t => t.needsReview).length;
  const unknownCount = snapshot.unknownSms.length;
  const last = [...snapshot.transactions].sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))[0];

  if (!q) {
    return 'سؤال را بنویس؛ فقط از همین حساب جواب می‌دهم.';
  }
  if (/خرج|هزینه/.test(q) && /ماه/.test(q)) {
    return `این ماه ${formatTomanLabel(month.expenseRial)} هزینه ثبت شده است.`;
  }
  if (/درآمد|واریز/.test(q) && /ماه/.test(q)) {
    return `این ماه ${formatTomanLabel(month.incomeRial)} درآمد ثبت شده است.`;
  }
  if (/پس‌انداز|پس انداز/.test(q)) {
    return `پس‌انداز این دوره ${formatTomanLabel(month.savingsRial)} است.`;
  }
  if (/بیشترین|کجا/.test(q)) {
    if (!top) {
      return 'هنوز داده کافی برای دستهٔ غالب نیست.';
    }
    return `بیشترین هزینه در دسته «${labels[top[0] as CategoryId]}» به مبلغ ${formatTomanLabel(top[1])} بوده است.`;
  }
  if (/غذا|خوراک/.test(q)) {
    const food = cats.food ?? 0;
    return food > 0 ? `هزینهٔ خورد و خوراک ${formatTomanLabel(food)} است.` : 'تراکنش غذایی ثبت نشده.';
  }
  if (/انتقال/.test(q)) {
    return `انتقال‌های شناسایی‌شده: ${snapshot.transfers.length} مورد، جمع ${formatTomanLabel(month.transferRial)}.`;
  }
  if (/بررسی|نامشخص|پیامک/.test(q)) {
    return `${reviewCount} تراکنش در صف بررسی و ${unknownCount} پیامک ناشناخته مانده است.`;
  }
  if (/آخرین|آخرین تراکنش/.test(q)) {
    if (!last) {
      return 'تراکنشی ثبت نشده.';
    }
    return `آخرین تراکنش: ${last.merchant ?? last.type}، ${formatTomanLabel(last.amountRial)}.`;
  }
  if (/موجودی|حساب/.test(q)) {
    const total = snapshot.accounts.reduce((s, a) => s + a.balanceRial, 0);
    return `موجودی مجموع حساب‌ها ${formatTomanLabel(total)} است.`;
  }
  return 'این سؤال را با دادهٔ همین حساب نمی‌توانم قطعی جواب بدهم؛ عددی از خودم نمی‌سازم.';
}
