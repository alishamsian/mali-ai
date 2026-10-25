const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function toEnglishDigits(input: string): string {
  return input
    .split('')
    .map(ch => {
      const p = PERSIAN_DIGITS.indexOf(ch);
      if (p >= 0) {
        return String(p);
      }
      const a = ARABIC_DIGITS.indexOf(ch);
      if (a >= 0) {
        return String(a);
      }
      return ch;
    })
    .join('');
}

export function toPersianDigits(input: string | number): string {
  return String(input).replace(/\d/g, d => PERSIAN_DIGITS[Number(d)]);
}

export function parseIntegerAmount(raw: string): number | null {
  const normalized = toEnglishDigits(raw).replace(/[^\d]/g, '');
  if (!normalized) {
    return null;
  }
  const value = Number.parseInt(normalized, 10);
  return Number.isFinite(value) ? value : null;
}

/** فقط رقم انگلیسی از ورودی (فارسی/عربی هم پذیرفته می‌شود). */
export function sanitizeAmountDigits(raw: string): string {
  return toEnglishDigits(raw).replace(/[^\d]/g, '');
}

/** نمایش مبلغ با جداکننده هزارگان و ارقام فارسی. */
export function formatAmountDisplay(digits: string): string {
  const normalized = sanitizeAmountDigits(digits);
  if (!normalized) {
    return '';
  }
  const grouped = normalized.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return toPersianDigits(grouped);
}

export function groupThousands(value: number): string {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(value)).toString();
  const grouped = abs.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}${grouped}`;
}
