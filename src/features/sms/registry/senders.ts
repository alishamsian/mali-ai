import { BANK_REGISTRY } from './banks';

/**
 * Legacy / registry sender aliases — used ONLY for:
 * - migration of existing selectedBankIds → legacy_system verified senders
 * - bank detector soft hints when sender not yet verified
 *
 * NOT authoritative for connected-bank SMS pipeline.
 * User-verified senders in settings.bankConnections are authoritative.
 */
export const BANK_SENDER_ALIASES: Record<string, string[]> = Object.fromEntries(
  BANK_REGISTRY.map(bank => [
    bank.id,
    unique([...bank.senders, ...bank.legacyAliases, bank.id]),
  ]),
);

function unique(items: string[]): string[] {
  return [...new Set(items.map(s => s.trim()).filter(Boolean))];
}

/** Flat list of all known bank sender fragments (for native-style matching). */
export function getAllKnownBankSenders(): string[] {
  return unique(Object.values(BANK_SENDER_ALIASES).flat());
}

export function matchBankIdBySender(sender: StringOrEmpty): string | undefined {
  const s = (sender ?? '').toLowerCase();
  if (!s) {
    return undefined;
  }
  for (const [bankId, aliases] of Object.entries(BANK_SENDER_ALIASES)) {
    if (aliases.some(a => s.includes(a.toLowerCase()))) {
      return bankId;
    }
  }
  return undefined;
}

export function isKnownBankSender(sender: StringOrEmpty): boolean {
  return matchBankIdBySender(sender) != null;
}

type StringOrEmpty = string | undefined | null;
