import { parseIntegerAmount } from '../../../../utils/numbers/digits';
import { detectCurrencyHint, toInternalRial } from '../../../../utils/currency/money';
import type { TransactionType } from '../../../../types/finance';
import type { NormalizedSms, ParsedTransaction } from '../../types';

const TYPE_KEYWORDS: Array<{ type: TransactionType; patterns: RegExp[]; weight: number }> = [
  // Refunds and reversals first: «واریز برگشت خرید» is a refund, not income.
  { type: 'reversal', patterns: [/برگشت تراکنش/, /ابطال/], weight: 0.86 },
  { type: 'refund', patterns: [/برگشت/, /بازگشت وجه/], weight: 0.88 },
  { type: 'purchase', patterns: [/خرید/, /خرید از/], weight: 0.95 },
  { type: 'transfer', patterns: [/انتقال/, /کارت به کارت/], weight: 0.93 },
  { type: 'deposit', patterns: [/واریز/, /واریز به/], weight: 0.96 },
  { type: 'withdrawal', patterns: [/برداشت/, /برداشت از/], weight: 0.96 },
  { type: 'fee', patterns: [/کارمزد/], weight: 0.9 },
];

/** Types whose direction never depends on context (a transfer can go either way). */
const CLEAR_TYPES = new Set<TransactionType>([
  'purchase',
  'withdrawal',
  'deposit',
  'fee',
  'refund',
]);

export function inferType(body: string): { type: TransactionType; confidence: number } {
  for (const entry of TYPE_KEYWORDS) {
    if (entry.patterns.some(p => p.test(body))) {
      return { type: entry.type, confidence: entry.weight };
    }
  }
  return { type: 'unknown', confidence: 0.4 };
}

/**
 * Picks the transaction amount out of an unfamiliar bank SMS by scoring every number:
 * dates, times, card/account numbers and masked digits are skipped; a number after
 * «مانده/موجودی» is the balance, not the amount; one after «مبلغ», a transaction word or
 * next to a +/− sign is likely the amount.
 */
export function extractAmountParts(
  body: string,
): { amount: number; currency: 'IRR' | 'IRT'; score: number } | null {
  const currency = detectCurrencyHint(body) ?? 'IRR';
  const text = body.replace(/(\d)[,٬،](?=\d{3})/g, '$1');
  let best: { value: number; score: number } | null = null;
  for (const m of text.matchAll(/\d{3,}/g)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    const before = text[start - 1] ?? ' ';
    const after = text[end] ?? ' ';
    const digitAt = (i: number) => /\d/.test(text[i] ?? '');
    if (
      '/*_'.includes(before) ||
      '/*_'.includes(after) ||
      // «12:10» is a time, but «مبلغ:420000» is an amount after a label.
      (before === ':' && digitAt(start - 2)) ||
      (after === ':' && digitAt(end + 1)) ||
      (before === '-' && digitAt(start - 2)) ||
      (after === '-' && digitAt(end + 1)) ||
      m[0].length > 12
    ) {
      continue;
    }
    const value = Number(m[0]);
    if (value < 1000) {
      continue;
    }
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const pre = text.slice(Math.max(lineStart, start - 25), start);
    const post = text.slice(end, end + 12).trim();
    let score = 0;
    if (/مانده|موجودی/.test(pre)) score -= 10;
    if (/حساب|کارت|شبا|کد|پیگیری|مرجع|شماره|رمز|پویا/.test(pre) && !/مبلغ|واریز/.test(pre))
      score -= 4;
    if (/مبلغ/.test(pre)) score += 5;
    if (/واریز|برداشت|خرید|انتقال|پرداخت|کسر/.test(pre)) score += 4;
    // «برداشت:1,000,000»: the number right after a type word and colon is that amount.
    if (/(واریز|برداشت|خرید|پرداخت|کسر)\s*:\s*$/.test(pre)) score += 2;
    if (pre.trim().endsWith('+') || after === '+') score += 4;
    if (pre.trim().endsWith('-') || after === '-') score += 3;
    if (/^(ریال|تومان|تومن|rial|irr)/i.test(post)) score += 2;
    if (!best || score > best.score) {
      best = { value, score };
    }
  }
  return best && best.score >= 0 ? { amount: best.value, currency, score: best.score } : null;
}

export function extractCardLast4(body: string): string | undefined {
  const match = body.match(/\*{2,}\s*(\d{4})/) ?? body.match(/(\d{4})\s*$/);
  return match?.[1];
}

export function extractMerchant(body: string): string | undefined {
  const fromPurchase = body.match(/خرید از\s+([^\n\r،,]{2,40})/);
  const fromTo = body.match(/به\s+([^\n\r،,]{2,40})/);
  const raw = fromPurchase?.[1] ?? fromTo?.[1];
  return raw?.trim().slice(0, 40);
}

export function extractBalance(body: string): number | undefined {
  const match = body.match(/مانده[:\s]*(-?[0-9,]{3,})/) ?? body.match(/موجودی[:\s]*(-?[0-9,]{3,})/);
  if (!match?.[1]) {
    return undefined;
  }
  const value = parseIntegerAmount(match[1].replace(/^-/, ''));
  return value == null ? undefined : match[1].startsWith('-') ? -value : value;
}

/**
 * Keyword-based fallback. This is NOT a bank-specific format parser.
 * Confidence stays lower so results usually land in needs-review.
 */
export function parseGenericBankSms(
  message: NormalizedSms,
  bankId = 'generic',
): ParsedTransaction | null {
  const typeInfo = inferType(message.body);
  const amountInfo = extractAmountParts(message.body);
  if (!amountInfo) {
    return null;
  }

  const amountRialDisplay = amountInfo.amount;
  const balance = extractBalance(message.body);
  // Clear enough to record without asking: a one-way type word, an amount the message
  // itself labels («مبلغ», a +/− sign or a type word), and the bank's balance after it.
  const clear = CLEAR_TYPES.has(typeInfo.type) && amountInfo.score >= 5 && balance != null;
  const overall = clear ? 0.9 : 0.55 * 0.7 + typeInfo.confidence * 0.2 + (amountInfo ? 1 : 0) * 0.1;

  return {
    bankId,
    type: typeInfo.type,
    amount: toInternalRial(amountRialDisplay, amountInfo.currency),
    currency: amountInfo.currency,
    balance: balance == null ? undefined : toInternalRial(balance, amountInfo.currency),
    cardLast4: extractCardLast4(message.body),
    transactionDate: message.receivedAt,
    merchant: extractMerchant(message.body),
    description: typeInfo.type,
    confidence: clear ? 0.9 : Math.min(0.84, Number(overall.toFixed(2))),
    source: 'android_sms',
    parserStatus: 'ok',
  };
}
