import type { FinanceSnapshot } from '../../database/schema/snapshot';
import type { CategoryId } from '../../types/finance';
import {
  firstCalmNightEligible,
  moneyTalksLine,
  occasionSpendHint,
  pastSelfInsight,
  zeroDayMoment,
} from './vaultMoments';

export type MomentTone = 'calm' | 'celebrate' | 'story' | 'wit' | 'season';

export interface DashboardMoment {
  id: string;
  tone: MomentTone;
  title: string;
  body: string;
  shareable?: boolean;
}

export function buildDashboardMoments(
  snapshot: FinanceSnapshot,
  categoryLabel: (id: CategoryId) => string,
): DashboardMoment[] {
  const dismissed = new Set(snapshot.settings.dismissedMomentIds ?? []);
  const out: DashboardMoment[] = [];
  const { transactions, profile, settings } = snapshot;

  if (
    firstCalmNightEligible(profile.createdAt, Boolean(settings.firstCalmNightDismissed)) &&
    !dismissed.has('calm_night')
  ) {
    out.push({
      id: 'calm_night',
      tone: 'calm',
      title: 'اولین شب آرام',
      body: 'این هفته برای اولین بار دقیقاً می‌دانی کجا رفت پولت.',
    });
  }

  const zero = zeroDayMoment(transactions);
  if (zero && !dismissed.has(`zero_${zero.dayKey}`)) {
    out.push({
      id: `zero_${zero.dayKey}`,
      tone: 'celebrate',
      title: zero.title,
      body: zero.body,
      shareable: true,
    });
  }

  const occasion = occasionSpendHint(transactions);
  if (occasion && !dismissed.has(`occasion_${occasion.title}`)) {
    out.push({
      id: `occasion_${occasion.title}`,
      tone: 'season',
      title: occasion.title,
      body: occasion.body,
    });
  }

  const talk = moneyTalksLine(transactions);
  if (talk && !dismissed.has('money_talks')) {
    out.push({
      id: 'money_talks',
      tone: 'wit',
      title: 'اگر پول حرف می‌زد',
      body: talk,
      shareable: true,
    });
  }

  const past = pastSelfInsight(transactions, categoryLabel);
  if (past && !dismissed.has('past_self')) {
    out.push({
      id: 'past_self',
      tone: 'story',
      title: 'نسخهٔ قبلیِ تو',
      body: past,
      shareable: true,
    });
  }

  return out.slice(0, 3);
}
