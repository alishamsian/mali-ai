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
  // Inside Persian text a leading +/− drifts to the far side («۸,۰۸۹,۰۰۰+»); an LTR
  // isolate keeps it on the number.
  return sign ? `\u2066${sign}${digits}\u2069` : digits;
}

export function formatTomanLabel(
  rial: number,
  options?: { sign?: boolean; displayCurrency?: DisplayCurrency },
): string {
  const currency = options?.displayCurrency ?? displayCurrencyPreference;
  const unit = currency === 'IRR' ? 'ریال' : 'تومان';
  return `${formatTomanFromRial(rial, options)} ${unit}`;
}

/** "۱۳٫۳ میلیون", "۸۵۰ هزار": for cards and charts where the exact figure is noise. */
export function formatCompactToman(rial: number): string {
  const toman = Math.abs(rialToToman(rial));
  const sign = rial < 0 ? '−' : '';
  const scaled = (value: number, unit: string) => {
    const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
    return `${sign}${toPersianDigits(String(rounded).replace('.', '٫'))} ${unit}`;
  };
  if (toman >= 1e9) {
    return scaled(toman / 1e9, 'میلیارد');
  }
  if (toman >= 1e6) {
    return scaled(toman / 1e6, 'میلیون');
  }
  if (toman >= 1e3) {
    return `${sign}${toPersianDigits(Math.round(toman / 1e3))} هزار`;
  }
  return `${sign}${toPersianDigits(Math.round(toman))}`;
}
