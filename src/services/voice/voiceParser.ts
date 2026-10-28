/**
 * Turns a spoken sentence ("پنجاه هزار تومان قهوه از کافه نیکو") into a draft
 * transaction. Pure text work on the phone; the draft is confirmed on the add screen.
 */

export type VoiceDraft = {
  rawText: string;
  /** 0 when no amount was heard. */
  amountToman: number;
  direction: 'in' | 'out';
  /** What the money was for, with amount and filler words removed. */
  merchant: string;
};

const DIGIT_MAP: Record<string, string> = {
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
};

const WORD_VALUES: Record<string, number> = {
  صفر: 0,
  یک: 1,
  یه: 1,
  دو: 2,
  سه: 3,
  چهار: 4,
  پنج: 5,
  شش: 6,
  شیش: 6,
  هفت: 7,
  هشت: 8,
  نه: 9,
  ده: 10,
  یازده: 11,
  دوازده: 12,
  سیزده: 13,
  چهارده: 14,
  پانزده: 15,
  پونزده: 15,
  شانزده: 16,
  شونزده: 16,
  هفده: 17,
  هیفده: 17,
  هجده: 18,
  هیجده: 18,
  نوزده: 19,
  بیست: 20,
  سی: 30,
  چهل: 40,
  پنجاه: 50,
  شصت: 60,
  هفتاد: 70,
  هشتاد: 80,
  نود: 90,
  صد: 100,
  یکصد: 100,
  دویست: 200,
  سیصد: 300,
  چهارصد: 400,
  پانصد: 500,
  پونصد: 500,
  ششصد: 600,
  هفتصد: 700,
  هشتصد: 800,
  نهصد: 900,
};

const SCALES: Record<string, number> = {
  هزار: 1_000,
  میلیون: 1_000_000,
  ملیون: 1_000_000,
  میلیارد: 1_000_000_000,
};
const TOMAN_WORDS = new Set(['تومان', 'تومن', 'تومنی', 'تومانی']);
const RIAL_WORDS = new Set(['ریال', 'ريال']);

const IN_WORDS = ['واریز', 'دریافت', 'درآمد', 'حقوق', 'گرفتم', 'طلبم', 'برگشت'];
const OUT_WORDS = ['خرج', 'هزینه', 'پرداخت', 'خرید', 'خریدم', 'دادم', 'قسط', 'قبض', 'برداشت'];
/** Dropped from the merchant text; they carry no meaning on their own. */
const FILLER = new Set([
  'از',
  'برای',
  'به',
  'در',
  'بابت',
  'و',
  'با',
  'رو',
  'را',
  'که',
  'یک',
  'یه',
  'کردم',
  'شد',
  'بود',
  'هست',
  ...IN_WORDS,
  ...OUT_WORDS,
]);

function normalize(text: string): string {
  return text
    .replace(/[۰-۹٠-٩]/g, ch => DIGIT_MAP[ch] ?? ch)
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/(\d)[,٬،](?=\d{3})/g, '$1')
    .replace(/‌/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenValue(token: string): number | null {
  if (/^\d+(\.\d+)?$/.test(token)) {
    return Number(token);
  }
  return token in WORD_VALUES ? WORD_VALUES[token] : null;
}

type AmountSpan = { start: number; end: number; value: number; rial: boolean };

/**
 * Reads the first run of number tokens: digits or words, joined by «و», with
 * هزار/میلیون/میلیارد scales ("2 میلیون و 500 هزار", "سیصد و پنجاه هزار").
 */
function findAmount(tokens: string[]): AmountSpan | null {
  for (let i = 0; i < tokens.length; i += 1) {
    if (tokenValue(tokens[i]) == null && !(tokens[i] in SCALES)) {
      continue;
    }
    let total = 0;
    let group = 0;
    let seen = false;
    let j = i;
    for (; j < tokens.length; j += 1) {
      const token = tokens[j];
      const value = tokenValue(token);
      if (value != null) {
        group += value;
        seen = true;
      } else if (token in SCALES) {
        total += (group || 1) * SCALES[token];
        group = 0;
        seen = true;
      } else if (
        token === 'و' &&
        seen &&
        j + 1 < tokens.length &&
        (tokenValue(tokens[j + 1]) != null || tokens[j + 1] in SCALES)
      ) {
        continue;
      } else {
        break;
      }
    }
    total += group;
    if (!seen || total <= 0) {
      continue;
    }
    let end = j;
    let rial = false;
    if (end < tokens.length && (TOMAN_WORDS.has(tokens[end]) || RIAL_WORDS.has(tokens[end]))) {
      rial = RIAL_WORDS.has(tokens[end]);
      end += 1;
    }
    return { start: i, end, value: total, rial };
  }
  return null;
}

export function parseVoiceTransaction(rawText: string): VoiceDraft {
  const tokens = normalize(rawText).split(' ').filter(Boolean);
  const amount = findAmount(tokens);
  const amountToman = amount ? Math.round(amount.rial ? amount.value / 10 : amount.value) : 0;

  const has = (words: string[]) => tokens.some(token => words.some(w => token.startsWith(w)));
  // Spending is the common case; income only when only income words were heard.
  const direction = has(IN_WORDS) && !has(OUT_WORDS) ? 'in' : 'out';

  const rest = tokens.filter((token, i) => {
    if (amount && i >= amount.start && i < amount.end) {
      return false;
    }
    return !FILLER.has(token) && !TOMAN_WORDS.has(token) && !RIAL_WORDS.has(token);
  });

  return { rawText, amountToman, direction, merchant: rest.join(' ') };
}
