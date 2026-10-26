import { useFinanceStore } from './store';

describe('merchant category rules', () => {
  beforeAll(async () => {
    await useFinanceStore.getState().hydrate();
  });

  it('keeps one rule per merchant and restores the earlier one on undo', () => {
    const store = useFinanceStore.getState();
    store.addCategoryRuleFromMerchant('اسنپ', 'transport');
    const first = useFinanceStore.getState().snapshot.rules.find(r => r.matcher === 'اسنپ');
    store.addCategoryRuleFromMerchant('اسنپ', 'food');
    let rules = useFinanceStore.getState().snapshot.rules.filter(r => r.matcher === 'اسنپ');
    expect(rules).toHaveLength(1);
    expect(rules[0].categoryId).toBe('food');

    useFinanceStore.getState().restoreMerchantRule('اسنپ', first);
    rules = useFinanceStore.getState().snapshot.rules.filter(r => r.matcher === 'اسنپ');
    expect(rules.map(r => r.categoryId)).toEqual(['transport']);

    useFinanceStore.getState().restoreMerchantRule('اسنپ', undefined);
    expect(useFinanceStore.getState().snapshot.rules.some(r => r.matcher === 'اسنپ')).toBe(false);
  });
});
