import type { FinanceSnapshot } from '../../database/schema/snapshot';
import { decryptBackupJson, isEncryptedBackupJson } from './backupCrypto';

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
};

export function buildSanitizedBackup(snapshot: FinanceSnapshot): BackupPayload {
  const { unknownSms: _unknown, syncQueue: _sync, ...rest } = snapshot;
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    profile: rest.profile,
    settings: {
      ...rest.settings,
      pinHash: undefined,
    },
    accounts: rest.accounts,
    transactions: rest.transactions.map(({ sourceSmsPreview: _preview, ...tx }) => tx),
    budgets: rest.budgets,
    budgetCategories: rest.budgetCategories,
    goals: rest.goals ?? [],
    recurring: rest.recurring ?? [],
    rules: rest.rules,
    transfers: rest.transfers,
    netWorthHistory: rest.netWorthHistory,
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

export function resolveBackupInput(
  raw: string,
  password?: string,
): { ok: true; data: BackupPayload } | { ok: false; error: string } {
  if (isEncryptedBackupJson(raw)) {
    if (!password) {
      return { ok: false, error: 'password-required' };
    }
    return decryptBackupJson(raw, password);
  }
  return validateBackupJson(raw);
}
