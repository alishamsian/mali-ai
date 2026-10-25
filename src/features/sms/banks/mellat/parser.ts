import { parseIntegerAmount } from '../../../../utils/numbers/digits';
import type { TransactionType } from '../../../../types/finance';
import type { BankSmsParser, NormalizedSms, ParsedTransaction } from '../../types';
import { detectMellat } from './detector';
import { MELLAT_AMOUNT, MELLAT_BALANCE, MELLAT_CARD } from './patterns';

function classify(body: string): TransactionType {
  if (/خرید|کسر\s*شد|برداشت/.test(body)) {
    return /خرید/.test(body) ? 'purchase' : 'withdrawal';
  }
  if (/واریز|واریزی|واریز\s*مبلغ/.test(body)) {
    return 'deposit';
  }
  if (/کارمزد/.test(body)) {
    return 'fee';
  }
  if (/برگشت|عودت/.test(body)) {
    return 'refund';
  }
  return 'unknown';
}

function extractMerchant(body: string): string | undefined {
  const hit = body.match(/خرید\s*از\s*(.+)/);
  if (!hit) {
    return undefined;
  }
  return hit[1].split('\n')[0]?.trim() || undefined;
}

export function parseMellatSms(message: NormalizedSms): ParsedTransaction | null {
  const amountHit = message.body.match(MELLAT_AMOUNT);
  if (!amountHit) {
    return null;
  }
  const amountRaw = amountHit[1] ?? amountHit[2];
  const amount = parseIntegerAmount(amountRaw ?? '');
  if (amount == null || amount < 1000) {
    return null;
  }
  const type = classify(message.body);
  if (type === 'unknown') {
    return null;
  }
  const balanceRaw = message.body.match(MELLAT_BALANCE)?.[1];
  const cardHit = message.body.match(MELLAT_CARD);
  const card = cardHit?.[1] ?? cardHit?.[2];
  const merchant = type === 'purchase' ? extractMerchant(message.body) : undefined;
  return {
    bankId: 'mellat',
    type,
    amount,
    currency: 'IRR',
    balance: balanceRaw ? parseIntegerAmount(balanceRaw) ?? undefined : undefined,
    cardLast4: card,
    merchant,
    transactionDate: message.receivedAt,
    description: merchant ?? (type === 'deposit' ? 'واریز' : type === 'purchase' ? 'خرید' : 'برداشت'),
    confidence: 0.9,
    source: 'android_sms',
    parserStatus: 'ok',
  };
}

export const mellatParser: BankSmsParser = {
  bankId: 'mellat',
  version: '1.0.0-mellat-samples',
  status: 'ok',
  canParse: detectMellat,
  parse: parseMellatSms,
};
