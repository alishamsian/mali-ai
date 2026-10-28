import type { AssetClass } from '../../types/wealth';

export type AnalyticsHubSection = 'overview' | 'calendar' | 'recap' | 'intel';
export type BudgetHubSection = 'budgets' | 'goals' | 'bills';

export type MainTabParamList = {
  Home: undefined;
  Daily: undefined;
  AddTab: undefined;
  Transactions: undefined;
  Vault: undefined;
  Analytics: { section?: AnalyticsHubSection; calendarDayKey?: string } | undefined;
};

export type AddTransactionParams = {
  mode?: 'expense' | 'income' | 'transfer' | 'receipt';
  /** Jalali day key YYYY-MM-DD — ثبت برای همان روز */
  dayKey?: string;
};

export type RootStackParamList = {
  Onboarding: undefined;
  SmsOnboarding: undefined;
  SmsSenderPicker: { bankId: string };
  SmsSenderConfirm: {
    bankId: string;
    sender: string;
    previewBody: string;
    body: string;
    receivedAt?: string;
    sourceSmsId?: string;
    startScanAfter?: boolean;
  };
  BankSendersManage: { bankId: string };
  SmsTest: undefined;
  Auth: undefined;
  Main: { screen?: keyof MainTabParamList } | undefined;
  Transactions: undefined;
  TransactionDetails: { id: string };
  AddTransaction: AddTransactionParams | undefined;
  Budgets: { section?: BudgetHubSection } | undefined;
  Insights: undefined;
  Analytics: { section?: AnalyticsHubSection; calendarDayKey?: string } | undefined;
  Tools: undefined;
  Recap: undefined;
  Calendar: undefined;
  DailyLedger: undefined;
  Assistant: undefined;
  /** Account edit screen (stack) — not the Settings tab. */
  AccountProfile: undefined;
  Settings: undefined;
  SettingsFinancial: undefined;
  SettingsBanksSms: undefined;
  SettingsAccounts: undefined;
  SettingsBudgets: undefined;
  SettingsReports: undefined;
  SettingsAssets: undefined;
  SettingsPrices: undefined;
  SettingsInsights: undefined;
  SettingsNotifications: undefined;
  SettingsSecurity: undefined;
  SettingsBackup: undefined;
  SettingsCloud: undefined;
  SettingsData: undefined;
  SettingsAppearance: undefined;
  SettingsLanguage: undefined;
  SettingsDeveloper: undefined;
  SettingsSupport: undefined;
  SettingsAbout: undefined;
  ReviewInbox: undefined;
  SmsParserLab: undefined;
  Recurring: undefined;
  Goals: undefined;
  Obligations: undefined;
  AddObligation: undefined;
  CinematicBalance: undefined;
  Privacy: undefined;
  Notifications: undefined;
  AssetDetail: { id: string };
  AddWealthAsset: { id?: string; assetClass?: AssetClass } | undefined;
};
