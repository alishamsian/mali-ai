import type { FinanceSnapshot } from '../../database/schema/snapshot';
import { decryptBackupJson, isEncryptedBackupJson } from './backupCrypto';
import { transactionForExport } from './transactionPrivacy';
import { backupSectionsValid } from './backupSections';

export const BACKUP_FORMAT = 'mali-backup' as const;
export const BACKUP_FORMAT_VERSION = 2;

export type BackupPayload = {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  profile: FinanceSnapshot['profile'];
  settings: FinanceSnapshot['settings'];
  accounts: FinanceSnapshot['accounts'];
  transactions: FinanceSnapshot['transactions'];
  budgets: FinanceSnapshot['budgets'];
  budgetCategories: FinanceSnapshot['budgetCategories'];
  goals: FinanceSnapshot['goals'];
  recurring: FinanceSnapshot['recurring'];
  rules: FinanceSnapshot['rules'];
  transfers: FinanceSnapshot['transfers'];
  netWorthHistory?: FinanceSnapshot['netWorthHistory'];
  installmentPlans?: FinanceSnapshot['installmentPlans'];
  cheques?: FinanceSnapshot['cheques'];
  debts?: FinanceSnapshot['debts'];
};

export function buildSanitizedBackup(snapshot: FinanceSnapshot): BackupPayload {
  // Fields are listed one by one: unknownSms (raw SMS text) and syncQueue never leave the device.
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    profile: snapshot.profile,
    settings: {
      ...snapshot.settings,
      pinHash: undefined,
    },
    accounts: snapshot.accounts,
    transactions: snapshot.transactions.map(transactionForExport),
    budgets: snapshot.budgets,
    budgetCategories: snapshot.budgetCategories,
    goals: snapshot.goals ?? [],
    recurring: snapshot.recurring ?? [],
    rules: snapshot.rules,
    transfers: snapshot.transfers,
    netWorthHistory: snapshot.netWorthHistory,
    installmentPlans: snapshot.installmentPlans ?? [],
    cheques: snapshot.cheques ?? [],
    debts: snapshot.debts ?? [],
  };
}

export function validateBackupJson(raw: string): { ok: true; data: BackupPayload } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(raw) as Partial<BackupPayload> & { version?: number };
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, error: 'invalid' };
    }
    if (parsed.format === BACKUP_FORMAT) {
      if (typeof parsed.version !== 'number' || parsed.version > BACKUP_FORMAT_VERSION) {
        return { ok: false, error: 'version' };
      }
      if (!Array.isArray(parsed.transactions) || !Array.isArray(parsed.accounts)) {
        return { ok: false, error: 'schema' };
      }
      return { ok: true, data: parsed as BackupPayload };
    }
    // legacy v1 export without format wrapper
    if (Array.isArray(parsed.transactions) && parsed.profile) {
      return {
        ok: true,
        data: {
          format: BACKUP_FORMAT,
          version: 1,
          exportedAt: (parsed as { exportedAt?: string }).exportedAt ?? new Date().toISOString(),
          profile: parsed.profile as FinanceSnapshot['profile'],
          settings: (parsed.settings ?? {}) as FinanceSnapshot['settings'],
          accounts: (parsed.accounts ?? []) as FinanceSnapshot['accounts'],
          transactions: (parsed.transactions ?? []) as FinanceSnapshot['transactions'],
          budgets: (parsed.budgets ?? []) as FinanceSnapshot['budgets'],
          budgetCategories: (parsed.budgetCategories ?? []) as FinanceSnapshot['budgetCategories'],
          goals: (parsed.goals ?? []) as FinanceSnapshot['goals'],
          recurring: (parsed.recurring ?? []) as FinanceSnapshot['recurring'],
          rules: (parsed.rules ?? []) as FinanceSnapshot['rules'],
          transfers: (parsed.transfers ?? []) as FinanceSnapshot['transfers'],
          netWorthHistory: parsed.netWorthHistory as FinanceSnapshot['netWorthHistory'],
        },
      };
    }
    return { ok: false, error: 'format' };
  } catch {
    return { ok: false, error: 'parse' };
  }
}

type BackupResult = { ok: true; data: BackupPayload } | { ok: false; error: string };

const OPTIONAL_ARRAYS = [
  'budgets',
  'budgetCategories',
  'goals',
  'recurring',
  'rules',
  'transfers',
  'netWorthHistory',
] as const;
const DIRECTIONS = new Set(['in', 'out', 'internal']);

const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isAmount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Shared with cloud restore: the minimum a record needs before it may enter the store. */
export function transactionLooksValid(tx: unknown): boolean {
  if (!tx || typeof tx !== 'object') {
    return false;
  }
  const t = tx as Record<string, unknown>;
  return (
    isText(t.id) &&
    isText(t.accountId) &&
    isAmount(t.amountRial) &&
    t.amountRial >= 0 &&
    DIRECTIONS.has(t.direction as string) &&
    isText(t.transactionDate) &&
    !Number.isNaN(Date.parse(t.transactionDate))
  );
}

export function accountLooksValid(account: unknown): boolean {
  if (!account || typeof account !== 'object') {
    return false;
  }
  const a = account as Record<string, unknown>;
  return isText(a.id) && typeof a.name === 'string' && isAmount(a.balanceRial);
}

/**
 * Item-level checks shared by plain and encrypted backups. A restore replaces the whole
 * store, so one malformed row rejects the file instead of half-importing broken data.
 */
export function checkBackupPayload(data: BackupPayload): BackupResult {
  if (!backupSectionsValid(data) || !Array.isArray(data.transactions) || !Array.isArray(data.accounts)) {
    return { ok: false, error: 'schema' };
  }
  for (const key of OPTIONAL_ARRAYS) {
    if (data[key] != null && !Array.isArray(data[key])) {
      return { ok: false, error: 'schema' };
    }
  }
  if (data.settings != null && typeof data.settings !== 'object') {
    return { ok: false, error: 'schema' };
  }
  if (!data.transactions.every(transactionLooksValid) || !data.accounts.every(accountLooksValid)) {
    return { ok: false, error: 'schema' };
  }
  const ids = new Set(data.transactions.map(tx => tx.id));
  const accountIds = new Set(data.accounts.map(a => a.id));
  if (ids.size !== data.transactions.length || accountIds.size !== data.accounts.length) {
    return { ok: false, error: 'schema' };
  }
  return { ok: true, data };
}

export function resolveBackupInput(raw: string, password?: string): BackupResult {
  let result: BackupResult;
  if (isEncryptedBackupJson(raw)) {
    if (!password) {
      return { ok: false, error: 'password-required' };
    }
    result = decryptBackupJson(raw, password);
  } else {
    result = validateBackupJson(raw);
  }
  return result.ok ? checkBackupPayload(result.data) : result;
}
