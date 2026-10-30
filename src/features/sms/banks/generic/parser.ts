import { parseIntegerAmount } from '../../../../utils/numbers/digits';
import { detectCurrencyHint, toInternalRial } from '../../../../utils/currency/money';
import type { TransactionType } from '../../../../types/finance';
import type { NormalizedSms, ParsedTransaction } from '../../types';

const TYPE_KEYWORDS: Array<{ type: TransactionType; patterns: RegExp[]; weight: number }> = [
  { type: 'purchase', patterns: [/خرید/, /خرید از/], weight: 0.95 },
  { type: 'transfer', patterns: [/انتقال/, /کارت به کارت/], weight: 0.93 },
  { type: 'deposit', patterns: [/واریز/, /واریز به/], weight: 0.96 },
  { type: 'withdrawal', patterns: [/برداشت/, /برداشت از/], weight: 0.96 },
  { type: 'fee', patterns: [/کارمزد/], weight: 0.9 },
  { type: 'refund', patterns: [/برگشت/, /بازگشت وجه/], weight: 0.88 },
  { type: 'reversal', patterns: [/برگشت تراکنش/, /ابطال/], weight: 0.86 },
];

export function inferType(body: string): { type: TransactionType; confidence: number } {
  for (const entry of TYPE_KEYWORDS) {
    if (entry.patterns.some(p => p.test(body))) {
      return { type: entry.type, confidence: entry.weight };
    }
  }
  return { type: 'unknown', confidence: 0.4 };
}

export function extractAmountParts(body: string): { amount: number; currency: 'IRR' | 'IRT' } | null {
  const currency = detectCurrencyHint(body) ?? 'IRR';
  const patterns = [
    /مبلغ[:\s]*([0-9]{3,})/,
    /([0-9]{4,})\s*(?:ریال|تومان|تومن)/,
    /(?:برداشت|واریز|خرید|انتقال)[^\d]{0,20}([0-9]{4,})/,
  ];
  for (const pattern of patterns) {
    const match = body.match(pattern);
    const parsed = match?.[1] ? parseIntegerAmount(match[1]) : null;
    if (parsed != null && parsed >= 1000) {
      return { amount: parsed, currency };
    }
  }
  return null;
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
  const match = body.match(/مانده[:\s]*([0-9,]{3,})/) ?? body.match(/موجودی[:\s]*([0-9,]{3,})/);
  if (!match?.[1]) {
    return undefined;
  }
  return parseIntegerAmount(match[1]) ?? undefined;
}

/**
 * Keyword-based fallback. This is NOT a bank-specific format parser.
 * Confidence stays lower so results usually land in needs-review.
 */
export function parseGenericBankSms(message: NormalizedSms, bankId = 'generic'): ParsedTransaction | null {
  const typeInfo = inferType(message.body);
  const amountInfo = extractAmountParts(message.body);
  if (!amountInfo) {
    return null;
  }

  const amountRialDisplay = amountInfo.amount;
  const balance = extractBalance(message.body);
  const overall =
    0.55 * 0.7 + typeInfo.confidence * 0.2 + (amountInfo ? 1 : 0) * 0.1;

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
    confidence: Math.min(0.84, Number(overall.toFixed(2))),
    source: 'android_sms',
    parserStatus: 'ok',
  };
}
