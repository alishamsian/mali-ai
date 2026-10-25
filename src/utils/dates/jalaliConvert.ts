/** Pure Jalali/Gregorian conversion. No dayjs — safe for Jest. */

function div(a: number, b: number): number {
  return Math.trunc(a / b);
}

export function jalaliToGregorian(jy: number, jm: number, jd: number): { year: number; month: number; day: number } {
  const jy0 = jy - 979;
  const jm0 = jm - 1;
  const jd0 = jd - 1;
  let jDayNo = 365 * jy0 + div(jy0, 33) * 8 + div((jy0 % 33) + 3, 4);
  for (let i = 0; i < jm0; i += 1) {
    jDayNo += i < 6 ? 31 : 30;
  }
  jDayNo += jd0;
  let gDayNo = jDayNo + 79;
  let gy = 1600 + 400 * div(gDayNo, 146097);
  gDayNo %= 146097;
  let leap = true;
  if (gDayNo >= 36525) {
    gDayNo -= 1;
    gy += 100 * div(gDayNo, 36524);
    gDayNo %= 36524;
    if (gDayNo >= 365) {
      gDayNo += 1;
    } else {
      leap = false;
    }
  }
  gy += 4 * div(gDayNo, 1461);
  gDayNo %= 1461;
  if (gDayNo >= 366) {
    leap = false;
    gDayNo -= 1;
    gy += div(gDayNo, 365);
    gDayNo %= 365;
  }
  const salA = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  let gd = gDayNo + 1;
  for (let i = 1; i <= 12; i += 1) {
    const v = salA[i];
    if (gd <= v) {
      gm = i;
      break;
    }
    gd -= v;
  }
  return { year: gy, month: gm, day: gd };
}

export function gregorianToJalali(gy: number, gm: number, gd: number): { year: number; month: number; day: number } {
  const gy0 = gy - 1600;
  const gm0 = gm - 1;
  const gd0 = gd - 1;
  let gDayNo = 365 * gy0 + div(gy0 + 3, 4) - div(gy0 + 99, 100) + div(gy0 + 399, 400);
  for (let i = 0; i < gm0; i += 1) {
    gDayNo += [31, gy % 4 === 0 && (gy % 100 !== 0 || gy % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][i];
  }
  gDayNo += gd0;
  let jDayNo = gDayNo - 79;
  const jNp = div(jDayNo, 12053);
  jDayNo %= 12053;
  let jy = 979 + 33 * jNp + 4 * div(jDayNo, 1461);
  jDayNo %= 1461;
  if (jDayNo >= 366) {
    jy += div(jDayNo - 1, 365);
    jDayNo = (jDayNo - 1) % 365;
  }
  let jm = 1;
  let jd = jDayNo + 1;
  for (let i = 0; i < 11; i += 1) {
    const dim = i < 6 ? 31 : 30;
    if (jd <= dim) {
      jm = i + 1;
      break;
    }
    jd -= dim;
    jm = i + 2;
  }
  return { year: jy, month: jm, day: jd };
}
