import type {
  BankConnection,
  DiscoveredSmsSender,
  SenderVerificationMethod,
  UserSettings,
  VerifiedSmsSender,
} from '../../../types/finance';
import { BANK_SENDER_ALIASES } from '../registry/senders';
import { normalizeSmsSender, sendersEqual, sendersMatch } from './normalize';

export function getBankConnections(settings: UserSettings): BankConnection[] {
  return settings.bankConnections ?? [];
}

export function getVerifiedSenderStrings(settings: UserSettings): string[] {
  const out: string[] = [];
  for (const conn of getBankConnections(settings)) {
    if (conn.status !== 'active' && conn.verifiedSenders.length === 0) {
      continue;
    }
    for (const vs of conn.verifiedSenders) {
      const n = normalizeSmsSender(vs.sender);
      if (n && !out.some(x => sendersEqual(x, n))) {
        out.push(n);
      }
    }
  }
  return out;
}

export function matchVerifiedBankId(
  settings: UserSettings,
  sender: string,
): { bankId: string; connectionId: string; confidence: number } | undefined {
  const n = normalizeSmsSender(sender);
  if (!n) {
    return undefined;
  }
  for (const conn of getBankConnections(settings)) {
    for (const vs of conn.verifiedSenders) {
      if (sendersMatch(n, vs.sender)) {
        return { bankId: conn.bankId, connectionId: conn.id, confidence: 1 };
      }
    }
  }
  return undefined;
}

export function isVerifiedSender(settings: UserSettings, sender: string): boolean {
  return matchVerifiedBankId(settings, sender) != null;
}

export function connectionForBank(
  settings: UserSettings,
  bankId: string,
): BankConnection | undefined {
  return getBankConnections(settings).find(c => c.bankId === bankId);
}

export function createBankConnection(input: {
  bankId: string;
  status?: BankConnection['status'];
  verifiedSenders?: VerifiedSmsSender[];
  now?: string;
}): BankConnection {
  const now = input.now ?? new Date().toISOString();
  return {
    id: `bc_${input.bankId}_${Date.now()}`,
    bankId: input.bankId,
    status: input.status ?? 'pending_sender_verification',
    verifiedSenders: input.verifiedSenders ?? [],
    createdAt: now,
    updatedAt: now,
  };
}

export function addVerifiedSender(
  connections: BankConnection[],
  bankId: string,
  senderRaw: string,
  method: SenderVerificationMethod = 'user_selected_sms',
  now = new Date().toISOString(),
): BankConnection[] {
  const sender = normalizeSmsSender(senderRaw);
  if (!sender) {
    return connections;
  }
  const list = [...connections];
  let idx = list.findIndex(c => c.bankId === bankId);
  if (idx < 0) {
    list.push(createBankConnection({ bankId, status: 'active', now }));
    idx = list.length - 1;
  }
  const conn = list[idx]!;
  if (conn.verifiedSenders.some(v => sendersEqual(v.sender, sender))) {
    return list.map((c, i) =>
      i === idx ? { ...c, status: 'active', updatedAt: now } : c,
    );
  }
  list[idx] = {
    ...conn,
    status: 'active',
    verifiedSenders: [
      ...conn.verifiedSenders,
      { sender, verifiedAt: now, method },
    ],
    updatedAt: now,
  };
  return list;
}

export function removeVerifiedSender(
  connections: BankConnection[],
  bankId: string,
  senderRaw: string,
  now = new Date().toISOString(),
): BankConnection[] {
  const sender = normalizeSmsSender(senderRaw);
  return connections.map(conn => {
    if (conn.bankId !== bankId) {
      return conn;
    }
    const verifiedSenders = conn.verifiedSenders.filter(v => !sendersEqual(v.sender, sender));
    return {
      ...conn,
      verifiedSenders,
      status: verifiedSenders.length === 0 ? 'pending_sender_verification' : conn.status,
      updatedAt: now,
    };
  });
}

/**
 * Migrate legacy selectedBankIds → bankConnections with system sender aliases.
 * Does NOT invent senders; uses existing BANK_SENDER_ALIASES only.
 * Idempotent: preserves user-verified entries.
 */
export function migrateBankConnections(settings: UserSettings): UserSettings {
  const existing = settings.bankConnections ?? [];
  if (existing.length > 0) {
    return {
      ...settings,
      bankConnections: existing,
      discoveredSmsSenders: settings.discoveredSmsSenders ?? [],
    };
  }
  const selected = settings.selectedBankIds ?? [];
  if (selected.length === 0) {
    return {
      ...settings,
      bankConnections: [],
      discoveredSmsSenders: settings.discoveredSmsSenders ?? [],
    };
  }
  const now = new Date().toISOString();
  const connections: BankConnection[] = selected.map(bankId => {
    const aliases = (BANK_SENDER_ALIASES[bankId] ?? [])
      .map(normalizeSmsSender)
      .filter(Boolean);
    const unique = [...new Set(aliases)];
    const verifiedSenders: VerifiedSmsSender[] = unique.map(sender => ({
      sender,
      verifiedAt: now,
      method: 'legacy_system' as const,
    }));
    return {
      id: `bc_legacy_${bankId}`,
      bankId,
      status: verifiedSenders.length > 0 ? 'active' : 'pending_sender_verification',
      verifiedSenders,
      createdAt: now,
      updatedAt: now,
    };
  });
  return {
    ...settings,
    bankConnections: connections,
    discoveredSmsSenders: settings.discoveredSmsSenders ?? [],
  };
}

export function noteDiscoveredSender(
  discovered: DiscoveredSmsSender[] | undefined,
  senderRaw: string,
  now = new Date().toISOString(),
): DiscoveredSmsSender[] {
  const sender = normalizeSmsSender(senderRaw);
  if (!sender || sender.length < 4) {
    return discovered ?? [];
  }
  const list = [...(discovered ?? [])];
  const idx = list.findIndex(d => sendersEqual(d.sender, sender));
  if (idx >= 0) {
    const cur = list[idx]!;
    if (cur.dismissed) {
      return list;
    }
    list[idx] = {
      ...cur,
      lastSeenAt: now,
      hitCount: cur.hitCount + 1,
    };
    return list;
  }
  list.push({
    sender,
    firstSeenAt: now,
    lastSeenAt: now,
    hitCount: 1,
  });
  return list.slice(0, 50);
}

export function syncSelectedBankIdsFromConnections(
  connections: BankConnection[],
): string[] {
  return [
    ...new Set(
      connections
        .filter(c => c.status === 'active' && c.verifiedSenders.length > 0)
        .map(c => c.bankId),
    ),
  ];
}
