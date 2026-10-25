import type { CategoryId, CategoryRule } from '../../types/finance';

const DEFAULT_RULES: Array<{ matcher: RegExp | string; category: CategoryId }> = [
  { matcher: /دیجی[\s\u200C]?کالا|digikala/i, category: 'shopping' },
  { matcher: /اسنپ|snapp/i, category: 'transport' },
  { matcher: /تپسی|tapsi/i, category: 'transport' },
  { matcher: /کافه|رستوران|غذا/i, category: 'food' },
  { matcher: /spotify|netflix|youtube/i, category: 'subscriptions' },
  { matcher: /اجاره|مسکن|رهن/i, category: 'housing' },
  { matcher: /برق|گاز|آب|مخابرات|ایرانسل|همراه اول/i, category: 'bills' },
  { matcher: /داروخانه|درمان|بیمارستان/i, category: 'health' },
  { matcher: /حقوق|واریز حقوق/i, category: 'income' },
];

export function categorize(input: {
  merchant?: string;
  description?: string;
  type?: string;
  userRules?: CategoryRule[];
}): CategoryId {
  const hay = `${input.merchant ?? ''} ${input.description ?? ''}`.toLowerCase();
  for (const rule of input.userRules ?? []) {
    if (hay.includes(rule.matcher.toLowerCase())) {
      return rule.categoryId;
    }
  }
  if (input.type === 'fee') {
    return 'fee';
  }
  if (input.type === 'transfer') {
    return 'transfer';
  }
  if (input.type === 'deposit') {
    return 'income';
  }
  for (const rule of DEFAULT_RULES) {
    if (typeof rule.matcher === 'string') {
      if (hay.includes(rule.matcher.toLowerCase())) {
        return rule.category;
      }
    } else if (rule.matcher.test(hay)) {
      return rule.category;
    }
  }
  return 'other';
}

export function ruleFromCorrection(userId: string, merchant: string, categoryId: CategoryId): CategoryRule {
  return {
    id: `rule_${Date.now()}`,
    userId,
    matcher: merchant.trim(),
    categoryId,
    createdAt: new Date().toISOString(),
  };
}
