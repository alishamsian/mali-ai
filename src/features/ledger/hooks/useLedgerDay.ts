import { useCallback, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { jalaliDayKey } from '../../../utils/dates/jalali';

/** null selection follows today; explicit historical selections survive midnight/focus. */
export function useLedgerDay() {
  const [now, setNow] = useState(() => new Date());
  const [selection, setSelection] = useState<string | null>(null);
  const today = jalaliDayKey(now);
  const refreshDate = useCallback(() => setNow(new Date()), []);

  useFocusEffect(
    useCallback(() => {
      let midnightTimer: ReturnType<typeof setTimeout>;
      const refresh = () => {
        const at = new Date();
        setNow(at);
        clearTimeout(midnightTimer);
        const midnight = new Date(at.getFullYear(), at.getMonth(), at.getDate() + 1);
        midnightTimer = setTimeout(refresh, Math.max(100, midnight.getTime() - at.getTime()));
      };
      refresh();
      // Covers manual clock/timezone changes while the app remains in the foreground.
      const clockTimer = setInterval(refresh, 60_000);
      const subscription = AppState.addEventListener('change', state => {
        if (state === 'active') {
          refresh();
        }
      });
      return () => {
        clearTimeout(midnightTimer);
        clearInterval(clockTimer);
        subscription.remove();
      };
    }, []),
  );

  const selectDay = useCallback(
    (key: string) => {
      const currentToday = jalaliDayKey(new Date());
      refreshDate();
      setSelection(key === currentToday ? null : key);
    },
    [refreshDate],
  );
  const goToday = useCallback(() => {
    refreshDate();
    setSelection(null);
  }, [refreshDate]);

  return { now, today, dayKey: selection ?? today, selectDay, goToday, refreshDate };
}
