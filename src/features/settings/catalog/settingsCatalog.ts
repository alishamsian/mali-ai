import type { RootStackParamList } from '../../../app/navigation/types';

export type SettingsRoute = keyof RootStackParamList | 'MainAccounts' | 'MainProfile' | 'AccountProfile';

export type SettingsEntry = {
  id: string;
  /** i18n path under dict.settings */
  titleKey: string;
  keywords: string[];
  route: SettingsRoute;
  group: 'finance' | 'wealth' | 'app' | 'support' | 'dev';
  statusKey?: string;
  /** Hidden from settings home — still searchable. */
  hiddenFromHome?: boolean;
};

/**
 * Searchable catalog — routes point to Control Center category screens
 * or existing feature screens (no duplicate implementations).
 */
export const SETTINGS_CATALOG: SettingsEntry[] = [
  {
    id: 'financial',
    titleKey: 'financial',
    keywords: ['ارز', 'تومان', 'ریال', 'تقویم', 'ماه مالی', 'currency', 'calendar'],
    route: 'SettingsFinancial',
    group: 'finance',
    hiddenFromHome: true,
  },
  {
    id: 'banksSms',
    titleKey: 'banksSms',
    keywords: ['پیامک', 'بانک', 'sms', 'parser', 'اسکن', 'ملت', 'ملی'],
    route: 'SettingsBanksSms',
    group: 'finance',
    statusKey: 'smsStatus',
  },
  {
    id: 'accounts',
    titleKey: 'accountsPayments',
    keywords: ['حساب', 'کارت', 'پرداخت', 'account'],
    route: 'SettingsAccounts',
    group: 'finance',
  },
  {
    id: 'budgets',
    titleKey: 'budgetsGoals',
    keywords: ['بودجه', 'هدف', 'budget', 'goal', 'هشدار'],
    route: 'SettingsBudgets',
    group: 'finance',
  },
  {
    id: 'reports',
    titleKey: 'reportsCategories',
    keywords: ['گزارش', 'دسته', 'category', 'تحلیل', 'تقویم'],
    route: 'SettingsReports',
    group: 'finance',
    hiddenFromHome: true,
  },
  {
    id: 'assets',
    titleKey: 'assetsValuation',
    keywords: ['دارایی', 'طلا', 'ثروت', 'asset', 'valuation', 'قیمت'],
    route: 'SettingsAssets',
    group: 'wealth',
    hiddenFromHome: true,
  },
  {
    id: 'prices',
    titleKey: 'currenciesPrices',
    keywords: ['قیمت', 'نرخ', 'طلا', 'کریپتو', 'provider', 'price'],
    route: 'SettingsPrices',
    group: 'wealth',
    hiddenFromHome: true,
  },
  {
    id: 'insights',
    titleKey: 'insights',
    keywords: ['بینش', 'insight', 'پیش‌بینی', 'هوش'],
    route: 'SettingsInsights',
    group: 'wealth',
    hiddenFromHome: true,
  },
  {
    id: 'notifications',
    titleKey: 'notifications',
    keywords: ['اعلان', 'notification', 'هشدار'],
    route: 'SettingsNotifications',
    group: 'app',
    statusKey: 'notifStatus',
  },
  {
    id: 'security',
    titleKey: 'security',
    keywords: ['امنیت', 'رمز', 'اثر انگشت', 'قفل', 'pin', 'biometric', 'حریم'],
    route: 'SettingsSecurity',
    group: 'app',
    statusKey: 'lockStatus',
  },
  {
    id: 'backup',
    titleKey: 'backupSync',
    keywords: ['پشتیبان', 'همگام', 'sync', 'backup', 'ابر', 'csv'],
    route: 'SettingsBackup',
    group: 'app',
  },
  {
    id: 'data',
    titleKey: 'dataManagement',
    keywords: ['داده', 'حذف', 'کش', 'export', 'import', 'پاک'],
    route: 'SettingsData',
    group: 'app',
    hiddenFromHome: true,
  },
  {
    id: 'appearance',
    titleKey: 'appearance',
    keywords: ['ظاهر', 'تم', 'تاریک', 'روشن', 'theme', 'dark', 'حرکت'],
    route: 'SettingsAppearance',
    group: 'app',
    statusKey: 'themeStatus',
  },
  {
    id: 'language',
    titleKey: 'languageRegion',
    keywords: ['زبان', 'منطقه', 'تقویم', 'فارسی', 'language'],
    route: 'SettingsLanguage',
    group: 'app',
    hiddenFromHome: true,
  },
  {
    id: 'support',
    titleKey: 'support',
    keywords: ['راهنما', 'پشتیبانی', 'help', 'بازخورد'],
    route: 'SettingsSupport',
    group: 'support',
    hiddenFromHome: true,
  },
  {
    id: 'about',
    titleKey: 'about',
    keywords: ['درباره', 'نسخه', 'about', 'version'],
    route: 'SettingsAbout',
    group: 'support',
  },
  {
    id: 'developer',
    titleKey: 'developer',
    keywords: ['توسعه‌دهنده', 'lab', 'parser', 'debug', 'diagnostics'],
    route: 'SettingsDeveloper',
    group: 'dev',
  },
];

export function searchSettings(query: string): SettingsEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [];
  }
  return SETTINGS_CATALOG.filter(entry => {
    if (entry.group === 'dev' && !__DEV__) {
      return false;
    }
    if (entry.titleKey.includes(q)) {
      return true;
    }
    return entry.keywords.some(k => k.toLowerCase().includes(q) || q.includes(k.toLowerCase()));
  });
}
