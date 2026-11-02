import { parseIntegerAmount } from '../../../../utils/numbers/digits';
import type { TransactionType } from '../../../../types/finance';
import { gregorianToJalali, jalaliToGregorian } from '../../../../utils/dates/jalaliConvert';
import type { BankSmsParser, NormalizedSms, ParsedTransaction } from '../../types';
import { detectMelli } from './detector';
import { MELLI_ACCOUNT, MELLI_BALANCE, MELLI_JALALI_TIME } from './patterns';

function classify(label: string, sign: '+' | '-'): TransactionType {
  if (/خرید/.test(label)) {
    return 'purchase';
  }
  if (/برداشت/.test(label)) {
    return 'withdrawal';
  }
  if (/کارمزد/.test(label)) {
    return 'fee';
  }
  if (/برگشت/.test(label)) {
    return 'refund';
  }
  if (sign === '+') {
    return 'deposit';
  }
  return 'withdrawal';
}

/** «-50000» is an overdrawn balance, not 50000. */
function signedAmount(raw: string | undefined): number | undefined {
  if (!raw) {
    return undefined;
  }
  const value = parseIntegerAmount(raw.replace(/^-/, ''));
  return value == null ? undefined : raw.startsWith('-') ? -value : value;
}

function extractLabel(beforeColon: string): string {
  const tokens = beforeColon.trim().split(/\s+/).filter(Boolean);
  let last = (tokens[tokens.length - 1] ?? '').replace(/^\.+/, '');
  const prev = tokens[tokens.length - 2]?.replace(/^\.+/, '') ?? '';
  if (prev && /^(حواله|کارت)$/.test(prev)) {
    last = `${prev} ${last}`;
  }
  return last.trim();
}

function parseJalaliStamp(body: string, receivedAt: string): string | undefined {
  const stamp = body.match(MELLI_JALALI_TIME);
  if (!stamp) {
    return undefined;
  }
  const month = Number(stamp[1]);
  const day = Number(stamp[2]);
  const hour = Number(stamp[3]);
  const minute = Number(stamp[4]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return undefined;
  }
  const received = new Date(receivedAt);
  const jy = gregorianToJalali(
    received.getFullYear(),
    received.getMonth() + 1,
    received.getDate(),
  ).year;
  const g = jalaliToGregorian(jy, month, day);
  return new Date(g.year, g.month - 1, g.day, hour, minute, 0).toISOString();
}

export function parseMelliSms(message: NormalizedSms): ParsedTransaction | null {
  const hit = /:(\d{4,})([+-])/.exec(message.body);
  if (!hit || hit.index == null) {
    return null;
  }
  const label = extractLabel(message.body.slice(0, hit.index));
  const amount = parseIntegerAmount(hit[1]);
  const sign = hit[2] as '+' | '-';
  if (!label || amount == null || amount < 1000) {
    return null;
  }
  const account = message.body.match(MELLI_ACCOUNT)?.[1];
  const balanceRaw = message.body.match(MELLI_BALANCE)?.[1];
  // The whole line names the type: «برگشت وجه» ends in «وجه», which alone reads as a deposit.
  const line = message.body.slice(message.body.lastIndexOf('\n', hit.index) + 1, hit.index);
  const type = classify(line, sign);
  return {
    bankId: 'melli',
    type,
    amount,
    currency: 'IRR',
    balance: signedAmount(balanceRaw),
    cardLast4: account ? account.slice(-4) : undefined,
    merchant: type === 'purchase' ? label : undefined,
    transactionDate: parseJalaliStamp(message.body, message.receivedAt) ?? message.receivedAt,
    description: label,
    confidence: 0.93,
    source: 'android_sms',
    parserStatus: 'ok',
  };
}

export const melliParser: BankSmsParser = {
  bankId: 'melli',
  version: '1.0.0-melli-bmi',
  status: 'ok',
  canParse: detectMelli,
  parse: parseMelliSms,
};
