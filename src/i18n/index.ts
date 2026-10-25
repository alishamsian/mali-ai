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

export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(vars[key] ?? ''));
}

export { current as currentLocale };
