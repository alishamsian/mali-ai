import { t, interpolate } from '../../i18n';
import { toPersianDigits } from '../../utils/numbers/digits';
import type { ChequeStatus } from '../../types/obligations';

/** "۳ روز مانده" / "امروز" / "۲ روز گذشته". */
export function daysLeftLabel(daysLeft: number): string {
  const dict = t().obligations;
  if (daysLeft === 0) {
    return dict.today;
  }
  return daysLeft > 0
    ? interpolate(dict.daysLeft, { n: toPersianDigits(daysLeft) })
    : interpolate(dict.overdue, { n: toPersianDigits(-daysLeft) });
}

export function chequeStatusLabel(status: ChequeStatus): string {
  const dict = t().obligations;
  switch (status) {
    case 'cleared':
      return dict.statusCleared;
    case 'bounced':
      return dict.statusBounced;
    case 'cancelled':
      return dict.statusCancelled;
    default:
      return dict.statusPending;
  }
}

export function newObligationId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}
