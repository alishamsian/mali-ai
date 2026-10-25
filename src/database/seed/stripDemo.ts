import type { FinanceSnapshot } from '../schema/snapshot';

const DEMO_ACCOUNT_IDS = new Set(['acc_mellat', 'acc_saman', 'acc_cash']);
const DEMO_BUDGET_IDS = new Set(['bud_month']);

export function isDemoTransaction(fingerprint: string, id: string): boolean {
  return fingerprint.startsWith('demo_') || /^tx_[1-6]$/.test(id) || id === 'tx_sal2';
}

export function stripSeededDemo(snapshot: FinanceSnapshot): FinanceSnapshot {
  const hadDemo =
    snapshot.accounts.some(a => DEMO_ACCOUNT_IDS.has(a.id)) ||
    snapshot.transactions.some(tx => isDemoTransaction(tx.fingerprint, tx.id));
  const transactions = snapshot.transactions.filter(
    tx => !isDemoTransaction(tx.fingerprint, tx.id) && !DEMO_ACCOUNT_IDS.has(tx.accountId),
  );
  const accounts = snapshot.accounts.filter(a => !DEMO_ACCOUNT_IDS.has(a.id));
  const budgets = snapshot.budgets.filter(b => !DEMO_BUDGET_IDS.has(b.id));
  const budgetCategories = snapshot.budgetCategories.filter(c => !DEMO_BUDGET_IDS.has(c.budgetId));
  return {
    ...snapshot,
    profile:
      hadDemo && snapshot.profile.displayName === 'علی'
        ? { ...snapshot.profile, displayName: '' }
        : snapshot.profile,
    accounts,
    transactions,
    budgets,
    budgetCategories,
    goals: snapshot.goals ?? [],
    recurring: snapshot.recurring ?? [],
    settings: { ...snapshot.settings, pinHash: undefined },
  };
}
