import type {
  Budget,
  BudgetCategory,
  CategoryRule,
  FinancialAccount,
  RecurringTransaction,
  SyncQueueItem,
  Transaction,
  TransferLink,
  UnknownSmsRecord,
  UserProfile,
  UserSettings,
  MoneyGoal,
} from '../../types/finance';
import type { NetWorthSnapshot } from '../../types/wealth';
import type { Cheque, InstallmentPlan, PersonalDebt } from '../../types/obligations';

export interface FinanceSnapshot {
  version: number;
  profile: UserProfile;
  settings: UserSettings;
  accounts: FinancialAccount[];
  transactions: Transaction[];
  transfers: TransferLink[];
  budgets: Budget[];
  budgetCategories: BudgetCategory[];
  rules: CategoryRule[];
  recurring: RecurringTransaction[];
  unknownSms: UnknownSmsRecord[];
  syncQueue: SyncQueueItem[];
  goals: MoneyGoal[];
  /** Daily-ish net worth samples for wealth charts */
  netWorthHistory?: NetWorthSnapshot[];
  installmentPlans: InstallmentPlan[];
  cheques: Cheque[];
  debts: PersonalDebt[];
  /** Keys of smart notifications already sent (device-only, capped). */
  alertLog?: string[];
}

export const SCHEMA_VERSION = 2;

export function emptySnapshot(userId = 'local-user'): FinanceSnapshot {
  const now = new Date().toISOString();
  return {
    version: SCHEMA_VERSION,
    profile: { id: userId, displayName: '', createdAt: now },
    settings: {
      userId,
      hideBalances: false,
      reducedMotion: false,
      theme: 'light',
      accentId: 'emerald',
      notificationsEnabled: true,
      budgetAlertsEnabled: true,
      smsProcessingEnabled: false,
      selectedBankIds: [],
      bankConnections: [],
      discoveredSmsSenders: [],
      onboardingCompleted: false,
      appLockEnabled: false,
      displayCurrency: 'IRT',
      calendar: 'jalali',
      financialMonthStartDay: 1,
      insightsEnabled: true,
      autoPriceUpdates: true,
      notificationPrefs: {
        transactions: true,
        assets: true,
        budgets: true,
        goals: true,
        system: true,
      },
    },
    accounts: [],
    transactions: [],
    transfers: [],
    budgets: [],
    budgetCategories: [],
    rules: [],
    recurring: [],
    unknownSms: [],
    syncQueue: [],
    goals: [],
    netWorthHistory: [],
    installmentPlans: [],
    cheques: [],
    debts: [],
  };
}
