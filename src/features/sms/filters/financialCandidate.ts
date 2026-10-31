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

export function looksFinancialCandidate(body: string): boolean {
  if (!body || !/\d/.test(body)) {
    return false;
  }
  return FINANCIAL_KEYS.some(k => body.includes(k));
}

/** Stronger gate against false positives (OTP / marketing with a lone number). */
export function hasTransactionSignals(body: string): boolean {
  if (!looksFinancialCandidate(body)) {
    return false;
  }
  const hasTxKeyword = TX_KEYS.some(k => body.includes(k));
  const hasAmountish = /\d{3,}/.test(body.replace(/[,\u066C\u060C]/g, ''));
  return hasTxKeyword && hasAmountish;
}
