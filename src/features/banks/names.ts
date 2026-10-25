import { fa } from '../../i18n/fa';
import { getBankRegistry } from '../sms/registry/banks';

/** Display name — registry is source of truth; i18n fallback for non-bank ids. */
export function resolveBankName(bankId?: string | null): string {
  if (!bankId) {
    return fa.banks.generic;
  }
  const reg = getBankRegistry(bankId);
  if (reg) {
    return reg.nameFa;
  }
  const legacy = fa.banks[bankId as keyof typeof fa.banks];
  if (legacy) {
    return legacy;
  }
  return fa.banks.generic;
}
