import type { FinanceSnapshot } from '../../database/schema/snapshot';
import type { NotificationPreferences } from '../../types/finance';
import { t, interpolate } from '../../i18n';
import { formatTomanFromRial } from '../../utils/currency/money';
import { toPersianDigits } from '../../utils/numbers/digits';
import { budgetAlerts } from '../budget/alerts';
import { detectAnomalies } from '../insights/pro';
import { isExpenseLike } from '../insights/analytics';
import { upcomingDues } from '../obligations/dues';
import { jalaliDayKey } from '../../utils/dates/jalali';

/** One notification. `at` set = reminder armed for later; unset = show now. */
export interface SmartAlert {
  /** Dedup key; an alert whose key was already sent is never sent again. */
  key: string;
  title: string;
  body: string;
  at?: number;
}

export type AlertInput = Pick<
  FinanceSnapshot,
  'transactions' | 'budgetCategories' | 'recurring' | 'installmentPlans' | 'cheques' | 'debts' | 'settings'
>;

const DAY_MS = 86_400_000;
const REMINDER_HOUR = 9;
const WEEKLY_HOUR = 20;
const FRIDAY = 5;
const REMINDER_HORIZON_DAYS = 35;

export const armedKey = (key: string) => `armed:${key}`;

const money = (rial: number) => formatTomanFromRial(rial);

function atHour(day: Date, hour: number): number {
  const d = new Date(day);
  d.setHours(hour, 0, 0, 0);
  return d.getTime();
}

function budgetNow(input: AlertInput, now: Date): SmartAlert[] {
  const dict = t();
  const month = jalaliDayKey(now).slice(0, 7);
  return budgetAlerts(input, now).map(a => {
    const name = dict.categories[a.categoryId];
    const over = a.ratio >= 1;
    return {
      key: `budget:${a.categoryId}:${month}:${over ? 100 : 80}`,
      title: over ? dict.smartAlerts.budgetOverTitle : dict.smartAlerts.budgetNearTitle,
      body: over
        ? interpolate(dict.smartAlerts.budgetOverBody, { name, used: money(a.usedRial), limit: money(a.limitRial) })
        : interpolate(dict.smartAlerts.budgetNearBody, { name, pct: toPersianDigits(Math.floor(a.ratio * 100)) }),
    };
  });
}

/** Only fresh transactions: an old one flagged on first run would be noise. */
function anomaliesNow(input: AlertInput, now: Date): SmartAlert[] {
  const dict = t().smartAlerts;
  const since = now.getTime() - DAY_MS;
  const fresh = new Set(
    input.transactions
      .filter(tx => isExpenseLike(tx) && Date.parse(tx.transactionDate) >= since)
      .map(tx => tx.id),
  );
  if (fresh.size === 0) {
    return [];
  }
  return detectAnomalies(input.transactions)
    .filter(a => fresh.has(a.id))
    .map(a => ({
      key: `anomaly:${a.id}`,
      title: dict.anomalyTitle,
      body: interpolate(dict.anomalyBody, {
        amount: money(a.amountRial),
        merchant: a.merchant,
        ratio: toPersianDigits(a.ratio),
      }),
    }));
}

function spentBetween(input: AlertInput, from: number, to: number): number {
  return input.transactions
    .filter(tx => {
      const at = Date.parse(tx.transactionDate);
      return isExpenseLike(tx) && at >= from && at < to;
    })
    .reduce((sum, tx) => sum + tx.amountRial, 0);
}

/** Friday evening (last day of the Jalali week): this week's spend vs the week before. */
function weekly(input: AlertInput, now: Date): SmartAlert[] {
  const dict = t().smartAlerts;
  const daysToFriday = (FRIDAY - now.getDay() + 7) % 7;
  const friday = new Date(now.getTime() + daysToFriday * DAY_MS);
  const key = `weekly:${jalaliDayKey(friday)}`;
  const fireAt = atHour(friday, WEEKLY_HOUR);
  if (now.getTime() < fireAt) {
    // Numbers would be stale by Friday; the armed reminder only says the summary is ready.
    return [{ key, title: dict.weeklyTitle, body: dict.weeklyNudgeBody, at: fireAt }];
  }
  const end = now.getTime();
  const spent = spentBetween(input, end - 7 * DAY_MS, end);
  if (spent <= 0) {
    return [];
  }
  const before = spentBetween(input, end - 14 * DAY_MS, end - 7 * DAY_MS);
  const pct = before > 0 ? Math.round(((spent - before) / before) * 100) : 0;
  const change =
    Math.abs(pct) < 5
      ? dict.weeklySame
      : interpolate(pct > 0 ? dict.weeklyMore : dict.weeklyLess, { pct: toPersianDigits(Math.abs(pct)) });
  return [{ key, title: dict.weeklyTitle, body: interpolate(dict.weeklyBody, { spent: money(spent), change }) }];
}

/** Reminders at 9:00 the day before and on the due day, for cheques, installments and debts. */
function dueReminders(input: AlertInput, now: Date): SmartAlert[] {
  const dict = t().smartAlerts;
  const dues = upcomingDues(
    { plans: input.installmentPlans, cheques: input.cheques, debts: input.debts },
    now,
    REMINDER_HORIZON_DAYS,
    input.settings.calendar ?? 'jalali',
  );
  const out: SmartAlert[] = [];
  for (const due of dues) {
    if (due.overdue) {
      continue;
    }
    const day = new Date(due.dueDate);
    const body = interpolate(dict.dueBody, { title: due.party ? `${due.title} · ${due.party}` : due.title, amount: money(due.amountRial) });
    out.push(
      { key: `due:${due.key}:-1`, title: dict.dueTomorrowTitle, body, at: atHour(new Date(day.getTime() - DAY_MS), REMINDER_HOUR) },
      { key: `due:${due.key}:0`, title: dict.dueTodayTitle, body, at: atHour(day, REMINDER_HOUR) },
    );
  }
  return out;
}

function billReminders(input: AlertInput, now: Date): SmartAlert[] {
  const dict = t().smartAlerts;
  const horizon = now.getTime() + REMINDER_HORIZON_DAYS * DAY_MS;
  return input.recurring
    .filter(r => {
      const at = Date.parse(r.nextExpectedDate);
      return at > now.getTime() && at <= horizon;
    })
    .map(r => ({
      key: `bill:${r.id}:${jalaliDayKey(r.nextExpectedDate)}`,
      title: dict.billTitle,
      body: interpolate(dict.billBody, { merchant: r.merchant, amount: money(r.amountRial) }),
      at: atHour(new Date(Date.parse(r.nextExpectedDate) - DAY_MS), REMINDER_HOUR),
    }));
}

/**
 * Everything the user should hear about right now (`at` unset) or later (`at` set),
 * filtered by their notification settings and by what was already sent.
 */
export function buildSmartAlerts(
  input: AlertInput,
  prefs: NotificationPreferences,
  sent: ReadonlySet<string>,
  now = new Date(),
): SmartAlert[] {
  const all: SmartAlert[] = [
    ...(prefs.budgets ? budgetNow(input, now) : []),
    ...(prefs.transactions ? [...anomaliesNow(input, now), ...weekly(input, now)] : []),
    ...(prefs.goals ? [...dueReminders(input, now), ...billReminders(input, now)] : []),
  ];
  return all.filter(a =>
    a.at == null
      ? // A Friday nudge that was armed already went out; do not repeat it with numbers.
        !sent.has(a.key) && !sent.has(armedKey(a.key))
      : a.at > now.getTime() && !sent.has(a.key),
  );
}
