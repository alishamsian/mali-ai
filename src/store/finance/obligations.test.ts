import { useFinanceStore } from './store';

const state = () => useFinanceStore.getState();
const now = '2026-10-10T08:00:00.000Z';

beforeAll(async () => {
  await state().hydrate();
});

describe('obligation actions', () => {
  it('marks an installment paid once', () => {
    state().upsertInstallmentPlan({
      id: 'plan_1',
      kind: 'loan',
      title: 'وام',
      installmentRial: 5_000,
      totalCount: 3,
      firstDueDate: now,
      payments: [],
      createdAt: now,
      updatedAt: now,
    });
    state().markInstallmentPaid('plan_1', 0);
    state().markInstallmentPaid('plan_1', 0);
    const plan = state().snapshot.installmentPlans.find(p => p.id === 'plan_1');
    expect(plan?.payments).toHaveLength(1);
    expect(plan?.payments[0]).toMatchObject({ index: 0, amountRial: 5_000 });
  });

  it('updates cheque status and settles debts', () => {
    state().upsertCheque({
      id: 'chq_1',
      direction: 'issued',
      amountRial: 9_000,
      dueDate: now,
      counterparty: 'علی',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
    state().setChequeStatus('chq_1', 'bounced');
    expect(state().snapshot.cheques.find(c => c.id === 'chq_1')?.status).toBe('bounced');

    state().upsertDebt({
      id: 'debt_1',
      person: 'سارا',
      direction: 'lent',
      amountRial: 2_000,
      date: now,
      settlements: [],
      createdAt: now,
      updatedAt: now,
    });
    state().settleDebt('debt_1', 2_000);
    expect(state().snapshot.debts.find(d => d.id === 'debt_1')?.settlements).toHaveLength(1);

    state().deleteCheque('chq_1');
    state().deleteDebt('debt_1');
    state().deleteInstallmentPlan('plan_1');
    expect(state().snapshot.cheques).toHaveLength(0);
    expect(state().snapshot.debts).toHaveLength(0);
    expect(state().snapshot.installmentPlans).toHaveLength(0);
  });
});
