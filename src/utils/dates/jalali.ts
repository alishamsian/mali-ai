import dayjs from 'dayjs';
import jalaliday from 'jalaliday';
import 'dayjs/locale/fa';
import { toPersianDigits } from '../numbers/digits';

dayjs.extend(jalaliday);

export function nowIso(): string {
  return new Date().toISOString();
}

export function toJalaliLabel(iso: string): string {
  return toPersianDigits(dayjs(iso).calendar('jalali').locale('fa').format('D MMMM YYYY'));
}

export function toJalaliMonthYear(iso: string): string {
  return toPersianDigits(dayjs(iso).calendar('jalali').locale('fa').format('MMMM YYYY'));
}

/** e.g. چهارشنبه ۲۶ مرداد */
export function toJalaliWeekdayDate(iso = nowIso()): string {
  return toPersianDigits(dayjs(iso).calendar('jalali').locale('fa').format('dddd D MMMM'));
}

export function toTimeLabel(iso: string): string {
  return toPersianDigits(dayjs(iso).locale('fa').format('HH:mm'));
}

export function startOfJalaliMonth(iso = nowIso()): Date {
  const d = dayjs(iso).calendar('jalali');
  return d.startOf('month').toDate();
}

export function addJalaliMonths(iso: string, months: number): string {
  return dayjs(iso).calendar('jalali').add(months, 'month').toISOString();
}

export function isSameDay(a: string, b: string): boolean {
  return dayjs(a).format('YYYY-MM-DD') === dayjs(b).format('YYYY-MM-DD');
}

export function daysBetween(a: string, b: string): number {
  return Math.abs(dayjs(a).diff(dayjs(b), 'day'));
}

export function hoursBetween(a: string, b: string): number {
  return Math.abs(dayjs(a).diff(dayjs(b), 'hour', true));
}

function localNoon(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
}

export function toJalaliYmd(iso: string): { year: number; month: number; day: number } {
  const raw = dayjs(iso).calendar('jalali').format('YYYY-MM-DD');
  const [year, month, day] = raw.split('-').map(Number);
  return { year, month, day };
}

const DAY_KEY_CACHE_LIMIT = 50_000;
const dayKeyCache = new Map<string, string>();

/**
 * Jalali calendar day key YYYY-MM-DD (شمسی).
 * String inputs are cached: analytics converts the same transaction dates thousands of
 * times per render, and each dayjs jalali conversion is comparatively expensive on Hermes.
 */
export function jalaliDayKey(iso: string | Date): string {
  if (typeof iso !== 'string') {
    return dayjs(iso).calendar('jalali').format('YYYY-MM-DD');
  }
  const hit = dayKeyCache.get(iso);
  if (hit !== undefined) {
    return hit;
  }
  if (dayKeyCache.size >= DAY_KEY_CACHE_LIMIT) {
    dayKeyCache.clear();
  }
  const key = dayjs(iso).calendar('jalali').format('YYYY-MM-DD');
  dayKeyCache.set(iso, key);
  return key;
}

export function todayJalaliKey(): string {
  return jalaliDayKey(new Date());
}

export function shiftJalaliDayKey(key: string, delta: number): string {
  const iso = isoForJalaliDayKey(key);
  return dayjs(iso).calendar('jalali').add(delta, 'day').format('YYYY-MM-DD');
}

/** Stable ISO anchor at local noon for a Jalali day key (for labels / navigation). */
export function isoForJalaliDayKey(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  return dayjs()
    .calendar('jalali')
    .year(year)
    .month(month - 1)
    .date(day)
    .hour(12)
    .minute(0)
    .second(0)
    .millisecond(0)
    .toDate()
    .toISOString();
}

export function jalaliDayLabel(key: string): string {
  return toJalaliLabel(isoForJalaliDayKey(key));
}

/** Short weekday for calendar strips (شنبه … جمعه) */
export function jalaliWeekdayShort(key: string): string {
  return dayjs(isoForJalaliDayKey(key)).calendar('jalali').locale('fa').format('dd');
}

export function isSameJalaliDay(a: string, b: string): boolean {
  return jalaliDayKey(a) === jalaliDayKey(b);
}

export function jalaliMonthMeta(now = new Date()): {
  year: number;
  month: number;
  day: number;
  daysInMonth: number;
  lead: number;
  start: Date;
} {
  const today = toJalaliYmd(localNoon(now).toISOString());
  const start = localNoon(now);
  start.setDate(start.getDate() - (today.day - 1));
  const lead = (start.getDay() + 1) % 7;
  let daysInMonth = 0;
  const cursor = new Date(start);
  while (true) {
    const part = toJalaliYmd(cursor.toISOString());
    if (part.year !== today.year || part.month !== today.month) {
      break;
    }
    daysInMonth += 1;
    cursor.setDate(cursor.getDate() + 1);
    if (daysInMonth > 32) {
      break;
    }
  }
  return { ...today, daysInMonth, lead, start };
}
