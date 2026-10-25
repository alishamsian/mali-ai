import { safeToSpendToday } from './safeToSpend';

const base = { dayOfMonth: 3, daysInMonth: 30, monthIncomeRial: 0, todayExpenseRial: 0 };

describe('safeToSpendToday', () => {
  it('splits what is left of the budget over the remaining days, today included', () => {
    const r = safeToSpendToday({
      ...base,
      monthlyLimitRial: 280_000_000,
      monthExpenseRial: 10_000_000,
      todayExpenseRial: 2_000_000,
    });
    // (280M − 8M spent before today) ÷ 28 days
    expect(r.basis).toBe('budget');
    expect(r.capRial).toBe(9_714_286);
    expect(r.leftRial).toBe(7_714_286);
  });

  it('falls back to income when there is no budget', () => {
    const r = safeToSpendToday({ ...base, monthlyLimitRial: null, monthIncomeRial: 56_000_000, monthExpenseRial: 0 });
    expect(r.basis).toBe('income');
    expect(r.capRial).toBe(2_000_000);
  });

  it('goes negative and reports over-ratio once today passes the cap', () => {
    const r = safeToSpendToday({
      ...base,
      monthlyLimitRial: 28_000_000,
      monthExpenseRial: 1_500_000,
      todayExpenseRial: 1_500_000,
    });
    expect(r.leftRial).toBe(-500_000);
    expect(r.ratio).toBeGreaterThan(1);
  });

  it('returns none without budget or income', () => {
    expect(safeToSpendToday({ ...base, monthlyLimitRial: null, monthExpenseRial: 5 }).basis).toBe('none');
  });
});
