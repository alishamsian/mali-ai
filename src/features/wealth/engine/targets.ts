import type { FinancialAccount } from '../../../types/finance';
import type { AssetClass } from '../../../types/wealth';
import { buildAllocation } from './portfolio';

export type Bucket = 'cash' | 'gold' | 'fx' | 'equity' | 'other';
export const BUCKETS: Bucket[] = ['cash', 'gold', 'fx', 'equity', 'other'];

const BUCKET_OF: Record<AssetClass, Bucket> = {
  cash: 'cash',
  bank: 'cash',
  gold: 'gold',
  silver: 'gold',
  jewelry: 'gold',
  currency: 'fx',
  crypto: 'fx',
  stock: 'equity',
  fund: 'equity',
  real_estate: 'other',
  vehicle: 'other',
  collectible: 'other',
  business: 'other',
  other: 'other',
};

export type TargetPreset = 'conservative' | 'balanced' | 'growth';
export const PRESETS: Record<TargetPreset, Record<Bucket, number>> = {
  conservative: { cash: 40, gold: 35, fx: 15, equity: 10, other: 0 },
  balanced: { cash: 25, gold: 30, fx: 20, equity: 20, other: 5 },
  growth: { cash: 15, gold: 20, fx: 25, equity: 35, other: 5 },
};

export type BucketRow = {
  bucket: Bucket;
  currentPct: number;
  targetPct: number;
  /** Positive = above target. */
  driftPct: number;
  /** Rial to move out of (positive) or into (negative) this bucket to hit the target. */
  driftRial: number;
};

/** Current share per bucket next to its target; drift > 0 means above target. */
export function allocationVsTarget(
  accounts: FinancialAccount[],
  targets: Partial<Record<Bucket, number>>,
): BucketRow[] {
  const current: Record<Bucket, number> = { cash: 0, gold: 0, fx: 0, equity: 0, other: 0 };
  let totalRial = 0;
  for (const slice of buildAllocation(accounts, 'all')) {
    current[BUCKET_OF[slice.assetClass]] += slice.percent;
    totalRial += slice.valueRial;
  }
  return BUCKETS.map(bucket => {
    const targetPct = targets[bucket] ?? 0;
    const currentPct = Math.round(current[bucket] * 10) / 10;
    const driftPct = Math.round((currentPct - targetPct) * 10) / 10;
    return {
      bucket,
      currentPct,
      targetPct,
      driftPct,
      driftRial: Math.round((driftPct / 100) * totalRial),
    };
  });
}
