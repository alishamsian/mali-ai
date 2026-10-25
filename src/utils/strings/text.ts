export function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

export function stripHiddenUnicode(input: string): string {
  return input.replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '');
}

export function normalizePersianArabicLetters(input: string): string {
  return input.replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/ة/g, 'ه');
}

export function normalizeCommas(input: string): string {
  return input.replace(/[٬،]/g, ',');
}

export function collapseZwnj(input: string): string {
  return input.replace(/\u200C/g, '\u200C');
}

export function simpleHash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) % 2147483647;
  }
  return Math.abs(h).toString(16);
}
