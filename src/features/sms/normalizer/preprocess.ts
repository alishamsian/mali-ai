import { detectCurrencyHint } from '../../../utils/currency/money';
import { toEnglishDigits } from '../../../utils/numbers/digits';
import {
  normalizeCommas,
  normalizePersianArabicLetters,
  normalizeWhitespace,
  stripHiddenUnicode,
} from '../../../utils/strings/text';
import type { NormalizedSms } from '../types';

export interface RawSmsInput {
  sender: string;
  senderName?: string;
  body: string;
  receivedAt: string;
}

export function preprocessSms(input: RawSmsInput): NormalizedSms {
  const cleaned = normalizeWhitespace(
    normalizePersianArabicLetters(
      toEnglishDigits(normalizeCommas(stripHiddenUnicode(input.body))).replace(/,/g, ''),
    ),
  );

  return {
    sender: input.sender.trim(),
    senderName: input.senderName?.trim(),
    body: cleaned,
    receivedAt: input.receivedAt,
    originalLength: input.body.length,
  };
}

export function extractCurrency(body: string) {
  return detectCurrencyHint(body);
}
