import {
  countEnabledNotificationPrefs,
  withSettingsDefaults,
} from './settingsDefaults';
import { searchSettings } from '../catalog/settingsCatalog';
import type { UserSettings } from '../../../types/finance';
import {
  formatTomanFromRial,
  formatTomanLabel,
  setDisplayCurrencyPreference,
  getDisplayCurrencyPreference,
} from '../../../utils/currency/money';

const base: UserSettings = {
  userId: 'u1',
  theme: 'dark',
  hideBalances: false,
  reducedMotion: false,
  onboardingCompleted: true,
  smsProcessingEnabled: false,
  selectedBankIds: [],
  notificationsEnabled: true,
  budgetAlertsEnabled: true,
  appLockEnabled: false,
};

describe('settingsDefaults', () => {
  it('fills missing Control Center fields without wiping legacy flags', () => {
    const out = withSettingsDefaults({
      ...base,
      notificationsEnabled: false,
    });
    expect(out.displayCurrency).toBe('IRT');
    expect(out.calendar).toBe('jalali');
    expect(out.financialMonthStartDay).toBe(1);
    expect(out.insightsEnabled).toBe(true);
    expect(out.notificationPrefs?.transactions).toBe(true);
    expect(out.notificationsEnabled).toBe(false);
  });

  it('clamps financial month start day', () => {
    expect(withSettingsDefaults({ ...base, financialMonthStartDay: 99 }).financialMonthStartDay).toBe(
      28,
    );
    expect(withSettingsDefaults({ ...base, financialMonthStartDay: 0 }).financialMonthStartDay).toBe(1);
  });

  it('counts enabled notification categories', () => {
    expect(countEnabledNotificationPrefs({ ...base, notificationsEnabled: false })).toBe(0);
    expect(countEnabledNotificationPrefs(base)).toBe(5);
    expect(
      countEnabledNotificationPrefs({
        ...base,
        notificationPrefs: {
          transactions: true,
          assets: false,
          budgets: true,
          goals: false,
          system: false,
        },
      }),
    ).toBe(2);
  });
});

describe('settings search', () => {
  it('finds SMS and gold related categories', () => {
    const sms = searchSettings('پیامک');
    expect(sms.some(e => e.id === 'banksSms')).toBe(true);
    const gold = searchSettings('طلا');
    expect(gold.some(e => e.id === 'assets' || e.id === 'prices')).toBe(true);
  });
});

describe('display currency preference', () => {
  afterEach(() => {
    setDisplayCurrencyPreference('IRT');
  });

  it('formats rials as toman by default', () => {
    setDisplayCurrencyPreference('IRT');
    expect(formatTomanFromRial(10_000, { persian: false })).toBe('1,000');
    expect(formatTomanLabel(10_000, { displayCurrency: 'IRT' })).toContain('تومان');
  });

  it('formats as rial when preference is IRR', () => {
    setDisplayCurrencyPreference('IRR');
    expect(getDisplayCurrencyPreference()).toBe('IRR');
    expect(formatTomanFromRial(10_000, { persian: false })).toBe('10,000');
    expect(formatTomanLabel(10_000)).toContain('ریال');
  });
});
