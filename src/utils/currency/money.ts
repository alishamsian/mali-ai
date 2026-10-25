import { groupThousands, toPersianDigits } from '../numbers/digits';

/** Internal money is always integer Rials. */
export const RIALS_PER_TOMAN = 10;

export type DisplayCurrency = 'IRR' | 'IRT';

/** Single source of truth for on-screen unit — synced from UserSettings.displayCurrency. */
let displayCurrencyPreference: DisplayCurrency = 'IRT';

export function setDisplayCurrencyPreference(currency: DisplayCurrency): void {
  displayCurrencyPreference = currency === 'IRR' ? 'IRR' : 'IRT';
}

export function getDisplayCurrencyPreference(): DisplayCurrency {
  return displayCurrencyPreference;
}

export function tomanToRial(toman: number): number {
  return Math.trunc(toman) * RIALS_PER_TOMAN;
}

export function rialToToman(rial: number): number {
  return Math.trunc(rial / RIALS_PER_TOMAN);
}

export function detectCurrencyHint(text: string): 'IRR' | 'IRT' | undefined {
  if (/تومان|تومن/.test(text)) {
    return 'IRT';
  }
  if (/ریال/.test(text)) {
    return 'IRR';
  }
  return undefined;
}

export function toInternalRial(amount: number, currency: 'IRR' | 'IRT'): number {
  return currency === 'IRT' ? tomanToRial(amount) : Math.trunc(amount);
}

/**
 * Formats stored rials for display using the app-wide displayCurrency preference
 * (IRT → تومان units, IRR → ریال units). Name kept for backward compatibility.
 */
export function formatTomanFromRial(
  rial: number,
  options?: { sign?: boolean; persian?: boolean; displayCurrency?: DisplayCurrency },
): string {
  const currency = options?.displayCurrency ?? displayCurrencyPreference;
  const amount = currency === 'IRR' ? Math.trunc(rial) : rialToToman(rial);
  const sign = options?.sign ? (amount > 0 ? '+' : amount < 0 ? '−' : '') : '';
  const grouped = groupThousands(Math.abs(amount));
  const digits = options?.persian === false ? grouped : toPersianDigits(grouped);
  return `${sign}${digits}`;
}

export function formatTomanLabel(
  rial: number,
  options?: { sign?: boolean; displayCurrency?: DisplayCurrency },
): string {
  const currency = options?.displayCurrency ?? displayCurrencyPreference;
  const unit = currency === 'IRR' ? 'ریال' : 'تومان';
  return `${formatTomanFromRial(rial, options)} ${unit}`;
}
