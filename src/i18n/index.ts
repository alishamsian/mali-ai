import { toPersianDigits } from '../utils/numbers/digits';
import { fa } from './fa';

export type Locale = 'fa' | 'en';

const dictionaries = { fa } as const;

let current: Locale = 'fa';

export function setLocale(locale: Locale) {
  current = locale;
}

export function t(): typeof fa {
  return dictionaries.fa;
}

/** Fills {{key}} slots; numbers come out in Persian digits like the rest of the UI. */
export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = vars[key];
    return typeof value === 'number' ? toPersianDigits(value) : String(value ?? '');
  });
}

export { current as currentLocale };
