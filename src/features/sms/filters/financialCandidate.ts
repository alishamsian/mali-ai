import { toEnglishDigits } from '../../../utils/numbers/digits';
import { normalizePersianArabicLetters } from '../../../utils/strings/text';

/**
 * The text the keyword gates read: Persian/Arabic digits as ASCII and Arabic ي/ك as
 * Persian, so «خريد:۱۲۰,۰۰۰» matches the same keywords and digit checks as «خرید:120,000».
 */
export function canonicalSmsText(body: string): string {
  return normalizePersianArabicLetters(toEnglishDigits(body ?? ''));
}

/** Soft gate: requires financial keywords + digit — not sender-only. */
const FINANCIAL_KEYS = [
  'برداشت',
  'واریز',
  'خرید',
  'مانده',
  'موجودی',
  'انتقال',
  'حواله',
  'حساب',
  'ریال',
  'تومان',
  'بانک',
  'بانك',
  'کارت',
];

const TX_KEYS = [
  'برداشت',
  'واریز',
  'خرید',
  'انتقال',
  'حواله',
  'برداشت وجه',
  'خریداينترنتی',
  'خریداینترنتی',
];

export function looksFinancialCandidate(raw: string): boolean {
  const body = canonicalSmsText(raw);
  if (!body || !/\d/.test(body)) {
    return false;
  }
  return FINANCIAL_KEYS.some(k => body.includes(k));
}

/** Stronger gate against false positives (OTP / marketing with a lone number). */
export function hasTransactionSignals(raw: string): boolean {
  const body = canonicalSmsText(raw);
  if (!looksFinancialCandidate(body)) {
    return false;
  }
  const hasTxKeyword = TX_KEYS.some(k => body.includes(k));
  const hasAmountish = /\d{3,}/.test(body.replace(/[,\u066C\u060C]/g, ''));
  return hasTxKeyword && hasAmountish;
}
