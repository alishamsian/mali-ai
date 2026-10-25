import { useMemo } from 'react';
import { useFinanceStore } from '../../../store/finance/store';
import { withSettingsDefaults } from './settingsDefaults';
import type { UserSettings } from '../../../types/finance';

/**
 * تنظیمات با پیش‌فرض‌ها — withSettingsDefaults را داخل selector نگذار
 * (آبجکت جدید در هر خواندن → لوپ بی‌نهایت React).
 */
export function useSettings(): UserSettings {
  const raw = useFinanceStore(s => s.snapshot.settings);
  return useMemo(() => withSettingsDefaults(raw), [raw]);
}
