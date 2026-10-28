/**
 * Nominal vs inflation-adjusted comparisons. The yearly rate is the user's setting (the
 * app does not claim an official figure); the dollar comparison uses USD rates the app
 * recorded itself from live prices, one per financial month.
 */

export function monthlyInflation(annualPct: number): number {
  return Math.pow(1 + annualPct / 100, 1 / 12) - 1;
}

export interface RealChange {
  /** Plain change vs the previous amount, in %. */
  nominalPct: number;
  /** Change after removing one month of inflation, in %. */
  realPct: number;
  /** The current amount in the previous month's money. */
  currentInPreviousMoneyRial: number;
}

export function realMonthOverMonth(
  currentRial: number,
  previousRial: number,
  annualPct: number,
): RealChange | null {
  if (previousRial <= 0) {
    return null;
  }
  const deflated = currentRial / (1 + monthlyInflation(annualPct));
  return {
    nominalPct: ((currentRial - previousRial) / previousRial) * 100,
    realPct: ((deflated - previousRial) / previousRial) * 100,
    currentInPreviousMoneyRial: Math.round(deflated),
  };
}

/** What `amountRial` held for `months` will buy, in today's money. */
export function purchasingPowerAfter(amountRial: number, months: number, annualPct: number): number {
  return Math.round(amountRial / Math.pow(1 + monthlyInflation(annualPct), months));
}

export interface DollarChange {
  currentUsd: number;
  previousUsd: number;
  pct: number;
}

export function dollarMonthOverMonth(
  currentRial: number,
  previousRial: number,
  usdRialNow?: number,
  usdRialPrev?: number,
): DollarChange | null {
  if (!usdRialNow || !usdRialPrev || previousRial <= 0) {
    return null;
  }
  const currentUsd = currentRial / usdRialNow;
  const previousUsd = previousRial / usdRialPrev;
  return { currentUsd, previousUsd, pct: ((currentUsd - previousUsd) / previousUsd) * 100 };
}
