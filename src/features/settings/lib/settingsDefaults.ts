import type { UserSettings } from '../../../types/finance';
import { migrateBankConnections } from '../../sms/senders/verified';

export const DEFAULT_NOTIFICATION_PREFS = {
  transactions: true,
  assets: true,
  budgets: true,
  goals: true,
  system: true,
} as const;

/** Normalize legacy snapshots so Control Center prefs always exist. */
export function withSettingsDefaults(settings: UserSettings): UserSettings {
  const base: UserSettings = {
    ...settings,
    // The glass redesign is the new default look; switch everyone to it once.
    theme: (settings.designVersion ?? 0) < 3 ? 'light' : settings.theme ?? 'light',
    designVersion: 3,
    accentId: settings.accentId ?? 'emerald',
    displayCurrency: settings.displayCurrency ?? 'IRT',
    calendar: settings.calendar ?? 'jalali',
    financialMonthStartDay: clampDay(settings.financialMonthStartDay ?? 1),
    insightsEnabled: settings.insightsEnabled ?? true,
    autoPriceUpdates: settings.autoPriceUpdates ?? true,
    budgetAlertsEnabled: settings.budgetAlertsEnabled ?? true,
    notificationsEnabled: settings.notificationsEnabled ?? true,
    notificationPrefs: {
      ...DEFAULT_NOTIFICATION_PREFS,
      ...settings.notificationPrefs,
    },
    moneySoundEnabled: settings.moneySoundEnabled ?? true,
    bankConnections: settings.bankConnections ?? [],
    discoveredSmsSenders: settings.discoveredSmsSenders ?? [],
  };
  return migrateBankConnections(base);
}

function clampDay(n: number): number {
  if (!Number.isFinite(n)) {
    return 1;
  }
  return Math.min(28, Math.max(1, Math.round(n)));
}

export function countEnabledNotificationPrefs(settings: UserSettings): number {
  const prefs = withSettingsDefaults(settings).notificationPrefs!;
  let n = 0;
  if (!settings.notificationsEnabled) {
    return 0;
  }
  for (const v of Object.values(prefs)) {
    if (v) {
      n += 1;
    }
  }
  return n;
}
