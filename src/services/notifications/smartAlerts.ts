import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { armedKey, buildSmartAlerts, type SmartAlert } from '../../engine/alerts/smartAlerts';
import { withSettingsDefaults } from '../../features/settings/lib/settingsDefaults';
import { useFinanceStore } from '../../store/finance/store';

type LocalNotifier = {
  show: (key: string, title: string, body: string) => void;
  replaceScheduled: (items: { id: string; title: string; body: string; at: number }[]) => Promise<number>;
};

const notifier: LocalNotifier | undefined =
  Platform.OS === 'android' ? NativeModules.LocalNotifier : undefined;

/** A burst on first run (many budgets crossed at once) is capped; the rest wait. */
const MAX_SHOWN_PER_RUN = 3;

let permissionAsked = false;

async function canNotify(): Promise<boolean> {
  if (Number(Platform.Version) < 33) {
    return true;
  }
  const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
  if (await PermissionsAndroid.check(permission)) {
    return true;
  }
  // Asked at most once per launch, and only when there is something to say.
  if (permissionAsked) {
    return false;
  }
  permissionAsked = true;
  return (await PermissionsAndroid.request(permission)) === PermissionsAndroid.RESULTS.GRANTED;
}

/** Shows what is due now and re-arms every later reminder. Safe to call often. */
export async function runSmartAlerts(now = new Date()): Promise<void> {
  if (!notifier) {
    return;
  }
  const store = useFinanceStore.getState();
  const snapshot = store.snapshot;
  const settings = withSettingsDefaults(snapshot.settings);
  // No permission prompt over the onboarding screens; the first run after it asks.
  if (!settings.onboardingCompleted) {
    return;
  }
  if (!settings.notificationsEnabled) {
    await notifier.replaceScheduled([]);
    return;
  }
  const alerts = buildSmartAlerts(snapshot, settings.notificationPrefs!, new Set(snapshot.alertLog ?? []), now);
  const scheduled = alerts.filter((a): a is SmartAlert & { at: number } => a.at != null);
  const immediate = alerts.filter(a => a.at == null).slice(0, MAX_SHOWN_PER_RUN);
  if (alerts.length === 0) {
    await notifier.replaceScheduled([]);
    return;
  }
  if (!(await canNotify())) {
    return;
  }
  for (const alert of immediate) {
    notifier.show(alert.key, alert.title, alert.body);
  }
  await notifier.replaceScheduled(toNative(scheduled));
  store.recordAlerts([
    ...immediate.map(a => a.key),
    ...scheduled.filter(a => a.key.startsWith('weekly:')).map(a => armedKey(a.key)),
  ]);
}

function toNative(items: (SmartAlert & { at: number })[]) {
  return items.map(a => ({ id: a.key, title: a.title, body: a.body, at: a.at }));
}

const WATCH_DEBOUNCE_MS = 4000;

/** Re-runs after data that feeds alerts changes (a new SMS, a new cheque). Returns unsubscribe. */
export function watchSmartAlerts(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const watched = (s: ReturnType<typeof useFinanceStore.getState>['snapshot']) => [
    s.transactions,
    s.budgetCategories,
    s.recurring,
    s.installmentPlans,
    s.cheques,
    s.debts,
    s.settings,
  ];
  const unsubscribe = useFinanceStore.subscribe((state, prev) => {
    const a = watched(state.snapshot);
    const b = watched(prev.snapshot);
    if (a.some((ref, i) => ref !== b[i])) {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => void runSmartAlerts(), WATCH_DEBOUNCE_MS);
    }
  });
  return () => {
    if (timer) {
      clearTimeout(timer);
    }
    unsubscribe();
  };
}
