import type { Transaction } from '../../types/finance';
import { isExpenseLike } from './analytics';

const DAY_MS = 86_400_000;

export interface MerchantHabit {
  name: string;
  count: number;
  totalRial: number;
  averageRial: number;
  /** Visits per week over the window. */
  perWeek: number;
  /** Spend scaled to a 30-day month. */
  monthlyRial: number;
}

function inWindow(transactions: Transaction[], from: number, to: number): Transaction[] {
  return transactions.filter(tx => {
    const at = Date.parse(tx.transactionDate);
    return at >= from && at < to && isExpenseLike(tx);
  });
}

/** Where the money goes most, by merchant, over the last `days`. */
export function topMerchants(transactions: Transaction[], now: Date, days = 90, limit = 5): MerchantHabit[] {
  const to = now.getTime();
  const txs = inWindow(transactions, to - days * DAY_MS, to);
  const groups = new Map<string, { name: string; count: number; total: number }>();
  for (const tx of txs) {
    const name = tx.merchant?.trim();
    if (!name) {
      continue;
    }
    const key = name.toLowerCase();
    const group = groups.get(key) ?? { name, count: 0, total: 0 };
    group.count += 1;
    group.total += tx.amountRial;
    groups.set(key, group);
  }
  // Scale by the history actually present, not the full window, for a new user.
  const first = txs.length ? Math.min(...txs.map(tx => Date.parse(tx.transactionDate))) : to;
  const spanDays = Math.max(7, Math.min(days, (to - first) / DAY_MS));
  return [...groups.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
    .map(g => ({
      name: g.name,
      count: g.count,
      totalRial: g.total,
      averageRial: Math.round(g.total / g.count),
      perWeek: Math.round((g.count / spanDays) * 7 * 10) / 10,
      monthlyRial: Math.round((g.total / spanDays) * 30),
    }));
}

/** Morning 6–12, midday 12–17, evening 17–22, night 22–6. */
export const DAY_BANDS = 4;

function bandOf(hour: number): number {
  if (hour >= 6 && hour < 12) {
    return 0;
  }
  if (hour >= 12 && hour < 17) {
    return 1;
  }
  if (hour >= 17 && hour < 22) {
    return 2;
  }
  return 3;
}

export interface SpendHeatmap {
  /** cells[weekday][band], weekday 0 = Saturday (Iranian week). */
  cells: number[][];
  maxRial: number;
  peak: { weekday: number; band: number } | null;
}

export function spendHeatmap(transactions: Transaction[], now: Date, days = 90): SpendHeatmap {
  const to = now.getTime();
  const cells = Array.from({ length: 7 }, () => new Array<number>(DAY_BANDS).fill(0));
  for (const tx of inWindow(transactions, to - days * DAY_MS, to)) {
    const d = new Date(tx.transactionDate);
    const weekday = (d.getDay() + 1) % 7;
    cells[weekday][bandOf(d.getHours())] += tx.amountRial;
  }
  let maxRial = 0;
  let peak: SpendHeatmap['peak'] = null;
  cells.forEach((row, weekday) =>
    row.forEach((value, band) => {
      if (value > maxRial) {
        maxRial = value;
        peak = { weekday, band };
      }
    }),
  );
  return { cells, maxRial, peak };
}
