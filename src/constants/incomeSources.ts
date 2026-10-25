export const INCOME_SOURCE_IDS = [
  'salary',
  'freelance',
  'gift',
  'investment',
  'refund',
  'other_income',
] as const;

export type IncomeSourceId = (typeof INCOME_SOURCE_IDS)[number];

export const QUICK_AMOUNT_TOMAN = [50_000, 100_000, 200_000, 500_000, 1_000_000, 2_000_000] as const;
