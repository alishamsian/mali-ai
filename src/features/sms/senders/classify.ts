import {
  canonicalSmsText,
  hasTransactionSignals,
  looksFinancialCandidate,
} from '../filters/financialCandidate';

const OTP_MARKERS = [
  'رمز پویا',
  'رمزپویا',
  'رمز یکبار',
  'رمز یک‌بار',
  'کد تأیید',
  'کد تایید',
  'کد ورود',
  'otp',
  'one-time',
  'verification code',
  'کد امنیتی',
  'رمز دوم',
];

const NON_TX_MARKERS = [
  ...OTP_MARKERS,
  'ورود به همراه بانک',
  'ورود موفق',
  'تلاش ناموفق',
  'تغییر رمز',
  'فعال‌سازی',
  'فعالسازی',
  'اطلاع‌رسانی تبلیغاتی',
  'تخفیف ویژه',
  'پیشنهاد ویژه',
  // Bank marketing that quotes an amount («تا ۵۰ میلیون وام بگیرید») but moves no money.
  'وام بگیرید',
  'تسهیلات',
  'قرعه‌کشی',
  'قرعه کشی',
  'جایزه',
  'باشگاه مشتریان',
  'دانلود',
  'نصب کنید',
  'ثبت‌نام',
  'ثبت نام',
  'http',
  'www.',
];

/** OTP / security / marketing — never create a transaction. */
export function isNonTransactionalSms(raw: string): boolean {
  if (!raw) {
    return true;
  }
  const body = canonicalSmsText(raw);
  const lower = body.toLowerCase();
  if (NON_TX_MARKERS.some(m => lower.includes(m.toLowerCase()))) {
    // OTP-like short codes often have digits but no ledger keywords
    if (OTP_MARKERS.some(m => lower.includes(m.toLowerCase()))) {
      return true;
    }
    // Marketing without clear TX amount pattern
    if (!hasTransactionSignals(body)) {
      return true;
    }
  }
  return false;
}

/**
 * Suitable for sender verification picker confirmation.
 * Rejects OTP/marketing; requires transaction-like signals.
 */
export function isSuitableForSenderVerification(body: string): boolean {
  if (isNonTransactionalSms(body)) {
    return false;
  }
  return hasTransactionSignals(body) || looksFinancialCandidate(body);
}

export type SmsMessageClass = 'transaction_candidate' | 'non_transactional' | 'ambiguous';

export function classifySmsBody(body: string): SmsMessageClass {
  if (isNonTransactionalSms(body)) {
    return 'non_transactional';
  }
  if (hasTransactionSignals(body)) {
    return 'transaction_candidate';
  }
  if (looksFinancialCandidate(body)) {
    return 'ambiguous';
  }
  return 'non_transactional';
}
