import { displayUnitLabel } from '../utils/currency/money';
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
    // {{unit}} is the display currency unless the caller passes one.
    const value = key === 'unit' && vars.unit === undefined ? displayUnitLabel() : vars[key];
    return typeof value === 'number' ? toPersianDigits(value) : String(value ?? '');
  });
}

export { current as currentLocale };
