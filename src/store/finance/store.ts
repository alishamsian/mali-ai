import { create } from 'zustand';
import type { FinanceSnapshot } from '../../database/schema/snapshot';
import { emptySnapshot } from '../../database/schema/snapshot';
import { stripSeededDemo } from '../../database/seed/stripDemo';
import {
  applyGuestPreview,
  clearGuestPreview,
  isGuestFingerprint,
  shouldOfferGuestPreview,
} from '../../database/seed/guestPreview';
import { pullCloudRecords } from '../../services/sync/pull';
import { signOutCloud } from '../../services/supabase/auth';
import { hapticSuccess } from '../../utils/haptics';
import { isLargeTransaction, playVaultChime } from '../../utils/vaultFeedback';
import { clearPinHash, storePinHash } from '../../services/security/pin';
import { clearVaultToken } from '../../services/security/vault';
import { resolveBackupInput } from '../../services/security/backup';
import { LocalFinanceDb } from '../../database/drivers/localDb';
import { bootstrapStorage, getStorageDriver } from '../../database/drivers/storageBootstrap';
import { FinanceRepository, bindRepository } from '../../database/repositories/financeRepository';
import { withSettingsDefaults } from '../../features/settings/lib/settingsDefaults';
import { setDisplayCurrencyPreference } from '../../utils/currency/money';
import type {
  Budget,
  BudgetCategory,
  CategoryId,
  FinancialAccount,
  MoneyGoal,
  RecurringTransaction,
  Transaction,
  UnknownSmsRecord,
  UserProfile,
  UserSettings,
} from '../../types/finance';
import { applyTransferLinks, detectTransfers } from '../../engine/transfer/detect';
import {
  compactSyncQueue,
  createQueueItem,
  enqueueSync,
  mergeFlushedQueue,
} from '../../services/sync/queue';
import { monthlyTotals } from '../../engine/insights/analytics';
import { ruleFromCorrection } from '../../engine/category/engine';
import {
  ingestIncomingSms,
  recomputeAccountBalancesFromSms,
  type IngestSmsOptions,
  type RawSmsPayload,
} from '../../features/sms/ingest';
import {
  checkpointPatchFromResult,
  runIncrementalSmsSync,
  type IncrementalSyncResult,
  type IncrementalSyncStatus,
} from '../../features/sms/import/incrementalSync';
import { syncVerifiedSendersToNative } from '../../features/sms/native/SmsModule';
import {
  addVerifiedSender,
  getVerifiedSenderStrings,
  noteDiscoveredSender,
  removeVerifiedSender,
  syncSelectedBankIdsFromConnections,
} from '../../features/sms/senders/verified';
import type { SenderVerificationMethod } from '../../types/finance';
import { flushSyncQueue } from '../../services/sync/flush';
import { findCrossSourceDuplicate } from '../../engine/duplicate/crossSource';
import { appendNetWorthPoint } from '../../features/wealth/migration/migrateAccounts';
import { revalueFromDetails } from '../../features/wealth/engine/portfolio';
import { refreshPricesFromHoldings } from '../../features/wealth/pricing/providers';
import {
  financialMonthTransactions,
  type MonthWindowInput,
} from '../../engine/insights/monthPeriod';
import { applyUserTheme } from '../../theme/runtime';
import { SCHEMA_VERSION } from '../../database/schema/snapshot';
import { attachCrashLogStorage } from '../../services/crash/crashLog';

const NAV_STATE_KEY = 'mali.nav.state.v1';

let db: LocalFinanceDb | null = null;
let hydrating: Promise<void> | null = null;
let flushing: Promise<void> | null = null;

function requireDb(): LocalFinanceDb {
  if (!db) {
    throw new Error('Finance DB not initialized — call hydrate() first');
  }
  return db;
}

function pushVerifiedSendersToNative(settings: UserSettings) {
  void syncVerifiedSendersToNative(getVerifiedSenderStrings(settings));
}

function noteDiscoveredInSettings(settings: UserSettings, sender: string) {
  return noteDiscoveredSender(settings.discoveredSmsSenders, sender);
}

function relink(snapshot: FinanceSnapshot, transactions: Transaction[]): FinanceSnapshot {
  const links = detectTransfers(transactions, snapshot.profile.id);
  return {
    ...snapshot,
    transactions: applyTransferLinks(transactions, links),
    transfers: links,
  };
}

function applyBalance(accounts: FinancialAccount[], tx: Transaction): FinancialAccount[] {
  return accounts.map(a => {
    if (a.id !== tx.accountId) {
      return a;
    }
    let balanceRial = a.balanceRial;
    if (typeof tx.balanceAfterRial === 'number') {
      balanceRial = tx.balanceAfterRial;
    } else if (tx.direction === 'in') {
      balanceRial += tx.amountRial;
    } else if (tx.direction === 'out') {
      balanceRial -= tx.amountRial;
    }
    return { ...a, balanceRial, transactionCount: a.transactionCount + 1, updatedAt: tx.updatedAt };
  });
}

function reverseBalance(accounts: FinancialAccount[], tx: Transaction): FinancialAccount[] {
  return accounts.map(a => {
    if (a.id !== tx.accountId) {
      return a;
    }
    let balanceRial = a.balanceRial;
    if (tx.direction === 'in') {
      balanceRial -= tx.amountRial;
    } else if (tx.direction === 'out') {
      balanceRial += tx.amountRial;
    }
    return {
      ...a,
      balanceRial,
      transactionCount: Math.max(0, a.transactionCount - 1),
      updatedAt: new Date().toISOString(),
    };
  });
}

function hasSmsBalance(tx: Transaction): boolean {
  return tx.source === 'android_sms' && typeof tx.balanceAfterRial === 'number';
}

/**
 * Re-reads the bank-reported balance for just these accounts. Other accounts keep
 * their manual adjustments, as they would until their own next SMS.
 */
function recomputeSmsBalancesFor(
  accounts: FinancialAccount[],
  transactions: Transaction[],
  accountIds: string[],
): FinancialAccount[] {
  const ids = new Set(accountIds);
  const recomputed = recomputeAccountBalancesFromSms(
    accounts.filter(a => ids.has(a.id)),
    transactions,
  );
  const byId = new Map(recomputed.map(a => [a.id, a]));
  return accounts.map(a => byId.get(a.id) ?? a);
}

/**
 * Balances after removing `tx`. An SMS that carried the bank's balance is not undone by
 * its amount: the account falls back to the latest remaining SMS balance, and only when
 * none is left to the balance before that SMS.
 */
function balancesAfterRemoving(
  accounts: FinancialAccount[],
  tx: Transaction,
  remaining: Transaction[],
): FinancialAccount[] {
  const reversed = reverseBalance(accounts, tx);
  return hasSmsBalance(tx)
    ? recomputeSmsBalancesFor(reversed, remaining, [tx.accountId])
    : reversed;
}

/** Balances after `before` is edited into `after` (amount, direction or account changed). */
function balancesAfterEditing(
  accounts: FinancialAccount[],
  before: Transaction,
  after: Transaction,
  transactions: Transaction[],
): FinancialAccount[] {
  if (
    before.amountRial === after.amountRial &&
    before.direction === after.direction &&
    before.accountId === after.accountId
  ) {
    return accounts;
  }
  const moved = applyBalance(reverseBalance(accounts, before), after);
  return hasSmsBalance(before) || hasSmsBalance(after)
    ? recomputeSmsBalancesFor(moved, transactions, [before.accountId, after.accountId])
    : moved;
}

function syncDisplayCurrency(settings: UserSettings) {
  const normalized = withSettingsDefaults(settings);
  setDisplayCurrencyPreference(normalized.displayCurrency ?? 'IRT');
}

/** In-memory SMS batch: mutate without MMKV stringify / Zustand fan-out each SMS. */
let smsBatchDepth = 0;
let smsBatchWorking: FinanceSnapshot | null = null;
let smsBatchSourceIds: Set<string> | null = null;

function isSmsBatching(): boolean {
  return smsBatchDepth > 0 && smsBatchWorking != null;
}

function liveSnapshot(get: () => FinanceState): FinanceSnapshot {
  return smsBatchWorking ?? get().snapshot;
}

/**
 * Full persist. During an SMS batch it also replaces the working copy, so a user action
 * taken mid-sync survives the batch's final write instead of being overwritten by it.
 */
function persistSet(set: (partial: Partial<FinanceState>) => void, snapshot: FinanceSnapshot) {
  if (isSmsBatching()) {
    smsBatchWorking = snapshot;
  }
  syncDisplayCurrency(snapshot.settings);
  requireDb().save(snapshot);
  set({ snapshot });
}

/** During batch: write working copy only. Outside: full persist. */
function commitSnapshot(set: (partial: Partial<FinanceState>) => void, snapshot: FinanceSnapshot) {
  if (isSmsBatching()) {
    smsBatchWorking = snapshot;
    return;
  }
  persistSet(set, snapshot);
}

function startSmsBatchInternal(get: () => FinanceState) {
  if (smsBatchDepth === 0) {
    const snap = get().snapshot;
    smsBatchWorking = snap;
    smsBatchSourceIds = new Set(
      snap.transactions.map(tx => tx.sourceSmsId).filter((id): id is string => Boolean(id)),
    );
  }
  smsBatchDepth += 1;
}

function finishSmsBatchInternal(
  set: (partial: Partial<FinanceState>) => void,
  _get: () => FinanceState,
) {
  smsBatchDepth = Math.max(0, smsBatchDepth - 1);
  if (smsBatchDepth > 0) {
    return;
  }
  const working = smsBatchWorking;
  smsBatchWorking = null;
  smsBatchSourceIds = null;
  if (!working) {
    return;
  }
  const linked = relink(working, working.transactions);
  persistSet(set, {
    ...linked,
    accounts: recomputeAccountBalancesFromSms(linked.accounts, linked.transactions),
  });
}

interface FinanceState {
  snapshot: FinanceSnapshot;
  hydrated: boolean;
  /** Set when the encrypted store could not be opened; nothing is loaded or saved. */
  storageError: { code: string; detail?: string } | null;
  /** Ephemeral SMS sync UI state (not persisted). */
  smsSync: {
    status: IncrementalSyncStatus;
    mode: 'incremental' | null;
    message?: string;
    lastResult?: IncrementalSyncResult;
  };
  hydrate: () => Promise<void>;
  wipeAllData: () => Promise<void>;
  persist: () => void;
  toggleHideBalances: () => void;
  completeOnboarding: () => void;
  /**
   * Returns false when a manual entry was not added because it duplicates an SMS
   * transaction; pass allowDuplicate after the user confirms it is a separate one.
   */
  addTransaction: (tx: Transaction, options?: { allowDuplicate?: boolean }) => boolean;
  deleteTransaction: (id: string) => void;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  confirmTransaction: (id: string) => void;
  recategorizeTransaction: (id: string, categoryId: CategoryId) => void;
  updateSettings: (patch: Partial<UserSettings>) => void;
  updateProfile: (patch: Partial<UserProfile>) => void;
  upsertAccount: (account: FinancialAccount) => void;
  deleteAccount: (id: string) => void;
  upsertBudget: (budget: Budget, categories: BudgetCategory[]) => void;
  upsertGoal: (goal: MoneyGoal) => void;
  deleteGoal: (id: string) => void;
  contributeGoal: (id: string, amountRial: number) => void;
  upsertRecurring: (item: RecurringTransaction) => void;
  deleteRecurring: (id: string) => void;
  ingestSms: (
    payload: RawSmsPayload,
    options?: IngestSmsOptions,
  ) => ReturnType<typeof ingestIncomingSms>;
  recomputeBalancesFromSms: () => void;
  beginSmsBatch: () => void;
  endSmsBatch: () => void;
  verifyBankSender: (input: {
    bankId: string;
    sender: string;
    method?: SenderVerificationMethod;
  }) => void;
  removeBankSender: (bankId: string, sender: string) => void;
  runIncrementalSmsSync: () => Promise<IncrementalSyncResult>;
  dismissUnknown: (id: string) => void;
  clearUnknownSms: () => void;
  dismissFirstSmsWin: () => void;
  dismissGuestPreview: () => void;
  joinProWaitlist: () => void;
  dismissMoment: (id: string) => void;
  markMonthClosingSeen: (monthKey: string) => void;
  dismissFirstCalmNight: () => void;
  addCategoryRuleFromMerchant: (merchant: string, categoryId: CategoryId) => void;
  /** Undo support: put back the merchant's earlier rule, or remove the rule if there was none. */
  restoreMerchantRule: (
    merchant: string,
    previous: FinanceSnapshot['rules'][number] | undefined,
  ) => void;
  flushCloud: () => Promise<void>;
  importBackupJson: (raw: string, password?: string) => { ok: true } | { ok: false; error: string };
  refreshWealthPrices: () => Promise<number>;
  /** After cloud sign-in: queue every account and transaction for upload. */
  enqueueFullUpload: () => void;
  /** Adds cloud accounts and transactions missing on this device; never overwrites local rows. */
  restoreFromCloud: () => Promise<
    { ok: true; addedTransactions: number; addedAccounts: number } | { ok: false; error: string }
  >;
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  snapshot: emptySnapshot(),
  hydrated: false,
  storageError: null,
  smsSync: { status: 'idle', mode: null },
  hydrate: () => {
    if (get().hydrated) {
      return Promise.resolve();
    }
    // One in-flight hydrate per store instance (StrictMode double effects, retry taps).
    if (!hydrating) {
      hydrating = (async () => {
        let driver;
        try {
          driver = await bootstrapStorage();
        } catch (e) {
          // Do not continue with an empty snapshot — persisting it would wipe real data.
          const err = e as { code?: string; name?: string; message?: string };
          set({
            storageError: {
              code: err?.code ?? 'unknown',
              detail: `${err?.name ?? 'Error'}: ${err?.message ?? String(e)}`,
            },
          });
          return;
        }
        set({ storageError: null });
        attachCrashLogStorage(driver);
        db = new LocalFinanceDb(driver);
        bindRepository(new FinanceRepository(db));
        const loaded = db.hasSnapshot() ? db.load() : emptySnapshot();
        const migratedHash = loaded.settings.pinHash;
        const cleaned = stripSeededDemo({
          ...loaded,
          settings: withSettingsDefaults({
            ...emptySnapshot().settings,
            ...loaded.settings,
            pinHash: undefined,
          }),
        });
        const linked = relink(
          {
            ...cleaned,
            goals: cleaned.goals ?? [],
            recurring: cleaned.recurring ?? [],
            // Older builds kept every synced item and every edit; shrink that on load.
            syncQueue: compactSyncQueue(cleaned.syncQueue ?? []),
          },
          cleaned.transactions,
        );
        const withGuest =
          linked.settings.onboardingCompleted && shouldOfferGuestPreview(linked)
            ? applyGuestPreview(linked)
            : linked;
        persistSet(set, withGuest);
        applyUserTheme({
          theme: withGuest.settings.theme,
          accentId: withGuest.settings.accentId,
        });
        pushVerifiedSendersToNative(withGuest.settings);
        set({ hydrated: true });
        if (migratedHash) {
          void storePinHash(migratedHash);
        }
      })().finally(() => {
        hydrating = null;
      });
    }
    return hydrating;
  },
  persist: () => {
    requireDb().save(liveSnapshot(get));
  },
  wipeAllData: async () => {
    try {
      await clearPinHash();
    } catch {
      // Keep wiping: the data matters more than a PIN record the reset settings no longer use.
    }
    await clearVaultToken();
    // The cloud session (refresh token) lives in the store being wiped.
    await signOutCloud();
    try {
      getStorageDriver().set(NAV_STATE_KEY, '');
    } catch {
      // nav storage optional before bootstrap edge cases
    }
    const fresh = emptySnapshot(get().snapshot.profile.id);
    persistSet(set, fresh);
    applyUserTheme({ theme: fresh.settings.theme, accentId: fresh.settings.accentId });
  },
  toggleHideBalances: () => {
    const snapshot = liveSnapshot(get);
    persistSet(set, {
      ...snapshot,
      settings: { ...snapshot.settings, hideBalances: !snapshot.settings.hideBalances },
    });
  },
  completeOnboarding: () => {
    const snapshot = liveSnapshot(get);
    let next = {
      ...snapshot,
      settings: { ...snapshot.settings, onboardingCompleted: true },
    };
    if (shouldOfferGuestPreview(next)) {
      next = applyGuestPreview(next);
    }
    persistSet(set, next);
  },
  addTransaction: (tx: Transaction, options) => {
    const snapshot = liveSnapshot(get);
    if (!options?.allowDuplicate && findSmsDuplicateOf(snapshot.transactions, tx)) {
      return false;
    }
    const nextTxs = [tx, ...snapshot.transactions];
    if (tx.sourceSmsId && smsBatchSourceIds) {
      smsBatchSourceIds.add(tx.sourceSmsId);
    }
    if (isSmsBatching() && tx.source === 'android_sms') {
      // Defer transfer-link + authoritative balance recompute until endSmsBatch.
      // A manual entry made mid-sync takes the normal path so it shows up at once.
      commitSnapshot(set, {
        ...snapshot,
        transactions: nextTxs,
        accounts: applyBalance(snapshot.accounts, tx),
        syncQueue: enqueueSync(
          snapshot.syncQueue,
          createQueueItem('transactions', tx.id, 'upsert', tx),
        ),
      });
      return true;
    }
    const linked = relink(snapshot, nextTxs);
    const bumped = applyBalance(snapshot.accounts, tx);
    const accounts =
      tx.source === 'android_sms'
        ? recomputeAccountBalancesFromSms(bumped, linked.transactions)
        : bumped;
    persistSet(set, {
      ...linked,
      accounts,
      syncQueue: enqueueSync(
        snapshot.syncQueue,
        createQueueItem('transactions', tx.id, 'upsert', tx),
      ),
    });
    return true;
  },
  deleteTransaction: id => {
    const snapshot = liveSnapshot(get);
    const tx = snapshot.transactions.find(item => item.id === id);
    if (!tx) {
      return;
    }
    const nextTxs = snapshot.transactions.filter(item => item.id !== id);
    persistSet(set, {
      ...relink(snapshot, nextTxs),
      accounts: balancesAfterRemoving(snapshot.accounts, tx, nextTxs),
      syncQueue: enqueueSync(
        snapshot.syncQueue,
        createQueueItem('transactions', id, 'delete', { id }),
      ),
    });
  },
  updateTransaction: (id, patch) => {
    const snapshot = liveSnapshot(get);
    const before = snapshot.transactions.find(tx => tx.id === id);
    if (!before) {
      return;
    }
    const updated: Transaction = { ...before, ...patch, updatedAt: new Date().toISOString() };
    const transactions = snapshot.transactions.map(tx => (tx.id === id ? updated : tx));
    persistSet(set, {
      ...relink(snapshot, transactions),
      accounts: balancesAfterEditing(snapshot.accounts, before, updated, transactions),
      syncQueue: enqueueSync(
        snapshot.syncQueue,
        createQueueItem('transactions', id, 'upsert', updated),
      ),
    });
  },
  confirmTransaction: id => {
    get().updateTransaction(id, { isConfirmed: true, needsReview: false, confidence: 1 });
  },
  recategorizeTransaction: (id, categoryId) => {
    const snapshot = liveSnapshot(get);
    const tx = snapshot.transactions.find(item => item.id === id);
    get().updateTransaction(id, {
      categoryId,
      isConfirmed: true,
      needsReview: false,
      confidence: 1,
    });
    if (tx?.merchant) {
      get().addCategoryRuleFromMerchant(tx.merchant, categoryId);
    }
  },
  updateSettings: patch => {
    const snapshot = liveSnapshot(get);
    const settings = withSettingsDefaults({ ...snapshot.settings, ...patch });
    persistSet(set, { ...snapshot, settings });
    if (patch.bankConnections != null || patch.selectedBankIds != null) {
      pushVerifiedSendersToNative(settings);
    }
  },
  verifyBankSender: ({ bankId, sender, method = 'user_selected_sms' }) => {
    const snapshot = liveSnapshot(get);
    const connections = addVerifiedSender(
      snapshot.settings.bankConnections ?? [],
      bankId,
      sender,
      method,
    );
    const settings = withSettingsDefaults({
      ...snapshot.settings,
      bankConnections: connections,
      selectedBankIds: syncSelectedBankIdsFromConnections(connections),
      smsProcessingEnabled: true,
    });
    const cleared = clearGuestPreview({ ...snapshot, settings });
    persistSet(set, cleared);
    pushVerifiedSendersToNative(settings);
  },
  removeBankSender: (bankId, sender) => {
    const snapshot = liveSnapshot(get);
    const connections = removeVerifiedSender(
      snapshot.settings.bankConnections ?? [],
      bankId,
      sender,
    );
    const settings = withSettingsDefaults({
      ...snapshot.settings,
      bankConnections: connections,
      selectedBankIds: syncSelectedBankIdsFromConnections(connections),
    });
    persistSet(set, { ...snapshot, settings });
    pushVerifiedSendersToNative(settings);
  },
  updateProfile: patch => {
    const snapshot = liveSnapshot(get);
    persistSet(set, { ...snapshot, profile: { ...snapshot.profile, ...patch } });
  },
  upsertAccount: account => {
    const snapshot = liveSnapshot(get);
    const valued = revalueFromDetails(account);
    const history = [...(valued.valueHistory ?? [])];
    const last = history[history.length - 1];
    if (!last || last.valueRial !== valued.balanceRial) {
      history.push({
        date: new Date().toISOString(),
        valueRial: valued.balanceRial,
        source: valued.priceSource ?? 'manual',
      });
    }
    const nextAccount = {
      ...valued,
      valueHistory: history.length > 120 ? history.slice(history.length - 120) : history,
      updatedAt: new Date().toISOString(),
    };
    const nextAccounts = [...snapshot.accounts.filter(a => a.id !== nextAccount.id), nextAccount];
    if (isSmsBatching()) {
      commitSnapshot(set, {
        ...snapshot,
        accounts: nextAccounts,
        syncQueue: enqueueSync(
          snapshot.syncQueue,
          createQueueItem('financial_accounts', nextAccount.id, 'upsert', nextAccount),
        ),
      });
      return;
    }
    const withHistory = appendNetWorthPoint({ ...snapshot, accounts: nextAccounts });
    persistSet(set, {
      ...withHistory,
      syncQueue: enqueueSync(
        snapshot.syncQueue,
        createQueueItem('financial_accounts', nextAccount.id, 'upsert', nextAccount),
      ),
    });
  },
  deleteAccount: id => {
    const snapshot = liveSnapshot(get);
    const nextAccounts = snapshot.accounts.filter(a => a.id !== id);
    const withHistory = appendNetWorthPoint({ ...snapshot, accounts: nextAccounts });
    persistSet(set, {
      ...withHistory,
      syncQueue: enqueueSync(
        snapshot.syncQueue,
        createQueueItem('financial_accounts', id, 'delete', { id }),
      ),
    });
  },
  upsertBudget: (budget, categories) => {
    const snapshot = liveSnapshot(get);
    persistSet(set, {
      ...snapshot,
      budgets: [...snapshot.budgets.filter(b => b.id !== budget.id), budget],
      budgetCategories: [
        ...snapshot.budgetCategories.filter(c => c.budgetId !== budget.id),
        ...categories,
      ],
    });
  },
  upsertGoal: goal => {
    const snapshot = liveSnapshot(get);
    persistSet(set, {
      ...snapshot,
      goals: [...snapshot.goals.filter(g => g.id !== goal.id), goal],
    });
  },
  deleteGoal: id => {
    const snapshot = liveSnapshot(get);
    persistSet(set, { ...snapshot, goals: snapshot.goals.filter(g => g.id !== id) });
  },
  contributeGoal: (id, amountRial) => {
    const snapshot = liveSnapshot(get);
    persistSet(set, {
      ...snapshot,
      goals: snapshot.goals.map(g =>
        g.id === id
          ? { ...g, savedRial: g.savedRial + amountRial, updatedAt: new Date().toISOString() }
          : g,
      ),
    });
  },
  upsertRecurring: item => {
    const snapshot = liveSnapshot(get);
    persistSet(set, {
      ...snapshot,
      recurring: [...snapshot.recurring.filter(r => r.id !== item.id), item],
    });
  },
  deleteRecurring: id => {
    const snapshot = liveSnapshot(get);
    persistSet(set, { ...snapshot, recurring: snapshot.recurring.filter(r => r.id !== id) });
  },
  ingestSms: (payload, options) => {
    let snapshot = liveSnapshot(get);
    if (snapshot.settings.guestPreviewActive) {
      snapshot = clearGuestPreview(snapshot);
      commitSnapshot(set, snapshot);
    }
    const hadSms = snapshot.transactions.some(tx => tx.source === 'android_sms');
    const result = ingestIncomingSms(snapshot, payload, {
      ...options,
      sourceSmsIdIndex: smsBatchSourceIds ?? undefined,
    });
    if (result.kind === 'ignored') {
      if (result.discoveredSender && !isSmsBatching()) {
        const discovered = noteDiscoveredInSettings(snapshot.settings, result.discoveredSender);
        if (discovered !== snapshot.settings.discoveredSmsSenders) {
          persistSet(set, {
            ...snapshot,
            settings: { ...snapshot.settings, discoveredSmsSenders: discovered },
          });
        }
      }
      return result;
    }
    if (result.kind === 'duplicate' || result.kind === 'non_transactional') {
      return result;
    }
    if (result.kind === 'updated' && result.transaction) {
      const { id, transactionDate } = result.transaction;
      if (!isSmsBatching()) {
        get().updateTransaction(id, { transactionDate });
        return result;
      }
      // In a batch: patch the working copy only (no per-SMS disk write).
      const live = liveSnapshot(get);
      const target = live.transactions.find(tx => tx.id === id);
      if (target) {
        const patched = { ...target, transactionDate, updatedAt: new Date().toISOString() };
        commitSnapshot(set, {
          ...live,
          transactions: live.transactions.map(tx => (tx.id === id ? patched : tx)),
          syncQueue: enqueueSync(
            live.syncQueue,
            createQueueItem('transactions', id, 'upsert', patched),
          ),
        });
      }
      return result;
    }
    if (result.kind === 'unknown' && result.unknown) {
      const unk = result.unknown;
      const exists = snapshot.unknownSms.some(u => {
        if (unk.sourceSmsId && u.sourceSmsId) {
          return u.sourceSmsId === unk.sourceSmsId;
        }
        return u.patternHash === unk.patternHash;
      });
      if (exists) {
        return result;
      }
      if (unk.sourceSmsId && smsBatchSourceIds) {
        smsBatchSourceIds.add(unk.sourceSmsId);
      }
      const unknownSms = [unk, ...snapshot.unknownSms].slice(0, 500);
      commitSnapshot(set, { ...snapshot, unknownSms });
      return result;
    }
    if (result.account) {
      get().upsertAccount(result.account);
    }
    if (result.transaction) {
      const live = liveSnapshot(get);
      const hit = findCrossSourceDuplicate(live.transactions, result.transaction);
      if (hit && hit.source === 'manual') {
        const merged: Transaction = {
          ...hit,
          ...result.transaction,
          id: hit.id,
          createdAt: hit.createdAt,
          mergedFromId: hit.id,
        };
        const without = live.transactions.filter(item => item.id !== hit.id);
        if (merged.sourceSmsId && smsBatchSourceIds) {
          smsBatchSourceIds.add(merged.sourceSmsId);
        }
        if (isSmsBatching()) {
          commitSnapshot(set, {
            ...live,
            transactions: [merged, ...without],
            accounts: applyBalance(reverseBalance(live.accounts, hit), merged),
            settings: hadSms
              ? live.settings
              : { ...live.settings, firstSmsWinReady: true, firstSmsWinDismissed: false },
          });
          return { ...result, kind: 'merged', transaction: merged };
        }
        persistSet(set, {
          ...relink(live, [merged, ...without]),
          accounts: applyBalance(reverseBalance(live.accounts, hit), merged),
          settings: hadSms
            ? live.settings
            : { ...live.settings, firstSmsWinReady: true, firstSmsWinDismissed: false },
        });
        if (!isSmsBatching()) {
          hapticSuccess();
        }
        return { ...result, kind: 'merged', transaction: merged };
      }
      get().addTransaction(result.transaction);
      if (isLargeTransaction(result.transaction.amountRial)) {
        playVaultChime(liveSnapshot(get).settings.moneySoundEnabled !== false);
      }
      if (!hadSms) {
        const after = liveSnapshot(get);
        commitSnapshot(set, {
          ...after,
          settings: { ...after.settings, firstSmsWinReady: true, firstSmsWinDismissed: false },
        });
      }
      if (!isSmsBatching()) {
        hapticSuccess();
      }
    }
    return result;
  },
  recomputeBalancesFromSms: () => {
    const live = liveSnapshot(get);
    commitSnapshot(set, {
      ...live,
      accounts: recomputeAccountBalancesFromSms(live.accounts, live.transactions),
    });
  },
  beginSmsBatch: () => {
    startSmsBatchInternal(get);
  },
  endSmsBatch: () => {
    finishSmsBatchInternal(set, get);
  },
  runIncrementalSmsSync: async () => {
    const settings = get().snapshot.settings;
    set({
      smsSync: {
        status: 'scanning',
        mode: 'incremental',
        message: 'در حال بروزرسانی تراکنش‌ها...',
      },
    });
    startSmsBatchInternal(get);
    let result: IncrementalSyncResult;
    try {
      result = await runIncrementalSmsSync({
        checkpoint: {
          lastSuccessfulSmsSyncAt: settings.lastSuccessfulSmsSyncAt,
          lastSuccessfulSmsSyncSmsDate: settings.lastSuccessfulSmsSyncSmsDate,
          lastSuccessfulSmsSyncSmsId: settings.lastSuccessfulSmsSyncSmsId,
          lastImportedTimestamp: settings.lastImportedTimestamp,
          lastHistoricalImportAt: settings.lastHistoricalImportAt,
        },
        smsProcessingEnabled: settings.smsProcessingEnabled,
        verifiedSenders: getVerifiedSenderStrings(settings),
        ingest: (payload, options) => get().ingestSms(payload, options),
        onProgress: partial => {
          if (partial.status === 'scanning' && (partial.scannedCount ?? 0) % 100 === 0) {
            set({
              smsSync: {
                status: 'scanning',
                mode: 'incremental',
                message: 'در حال بروزرسانی تراکنش‌ها...',
              },
            });
          }
        },
      });
    } finally {
      finishSmsBatchInternal(set, get);
    }

    const patch = checkpointPatchFromResult(result);
    if (patch) {
      get().updateSettings(patch);
    }

    // Balances already recomputed in endSmsBatch; keep call for safety if batch was empty
    if (result.status === 'completed' && result.createdCount > 0) {
      // no-op — endSmsBatch already ran recompute
    }

    if (result.status === 'completed') {
      set({
        smsSync: {
          status: 'completed',
          mode: 'incremental',
          message:
            result.scannedCount > 0
              ? `اسکن: ${result.scannedCount} · تراکنش: ${result.createdCount} · ناشناس: ${result.unknownCount} · تکراری: ${result.duplicateCount}`
              : 'تراکنش‌ها بروزرسانی شد',
          lastResult: result,
        },
      });
      // Clear lightweight banner after a short delay
      setTimeout(() => {
        const cur = get().smsSync;
        if (cur.status === 'completed') {
          set({ smsSync: { status: 'idle', mode: null, lastResult: cur.lastResult } });
        }
      }, 2200);
    } else if (result.status === 'skipped') {
      set({
        smsSync: {
          status: 'idle',
          mode: null,
          lastResult: result,
        },
      });
    } else {
      set({
        smsSync: {
          status: 'error',
          mode: 'incremental',
          message: 'بروزرسانی پیامک ناموفق بود',
          lastResult: result,
        },
      });
      setTimeout(() => {
        const cur = get().smsSync;
        if (cur.status === 'error') {
          set({ smsSync: { status: 'idle', mode: null, lastResult: cur.lastResult } });
        }
      }, 2800);
    }

    return result;
  },
  dismissUnknown: id => {
    const snapshot = liveSnapshot(get);
    persistSet(set, { ...snapshot, unknownSms: snapshot.unknownSms.filter(u => u.id !== id) });
  },
  clearUnknownSms: () => {
    const snapshot = liveSnapshot(get);
    persistSet(set, { ...snapshot, unknownSms: [] });
  },
  dismissFirstSmsWin: () => {
    const snapshot = liveSnapshot(get);
    persistSet(set, {
      ...snapshot,
      settings: { ...snapshot.settings, firstSmsWinDismissed: true, firstSmsWinReady: false },
    });
  },
  dismissGuestPreview: () => {
    const snapshot = liveSnapshot(get);
    persistSet(set, clearGuestPreview(snapshot));
  },
  joinProWaitlist: () => {
    const snapshot = liveSnapshot(get);
    persistSet(set, {
      ...snapshot,
      settings: { ...snapshot.settings, proWaitlistJoined: true },
    });
  },
  dismissMoment: id => {
    const snapshot = liveSnapshot(get);
    const prev = snapshot.settings.dismissedMomentIds ?? [];
    if (prev.includes(id)) {
      return;
    }
    persistSet(set, {
      ...snapshot,
      settings: { ...snapshot.settings, dismissedMomentIds: [...prev, id] },
    });
  },
  markMonthClosingSeen: monthKey => {
    const snapshot = liveSnapshot(get);
    persistSet(set, {
      ...snapshot,
      settings: { ...snapshot.settings, lastMonthClosingKey: monthKey },
    });
  },
  dismissFirstCalmNight: () => {
    const snapshot = liveSnapshot(get);
    persistSet(set, {
      ...snapshot,
      settings: { ...snapshot.settings, firstCalmNightDismissed: true },
    });
  },
  addCategoryRuleFromMerchant: (merchant, categoryId) => {
    const snapshot = liveSnapshot(get);
    persistSet(set, {
      ...snapshot,
      // One rule per merchant: a later correction replaces the earlier one instead of piling up.
      rules: [
        ...snapshot.rules.filter(r => r.matcher !== merchant.trim()),
        ruleFromCorrection(snapshot.profile.id, merchant, categoryId),
      ],
    });
  },
  restoreMerchantRule: (merchant, previous) => {
    const snapshot = liveSnapshot(get);
    const others = snapshot.rules.filter(r => r.matcher !== merchant.trim());
    persistSet(set, { ...snapshot, rules: previous ? [...others, previous] : others });
  },
  flushCloud: () => {
    // Interval, foreground and the settings button can overlap; share one flush.
    if (!flushing) {
      flushing = (async () => {
        const sent = liveSnapshot(get).syncQueue;
        if (sent.length === 0) {
          return;
        }
        const { queue: flushed, ran } = await flushSyncQueue(sent, {
          accounts: liveSnapshot(get).accounts,
        });
        if (!ran) {
          // No client or no user: nothing changed, so skip the full-snapshot write.
          return;
        }
        // Re-read after the await: edits made during the upload must not be overwritten.
        const live = liveSnapshot(get);
        persistSet(set, {
          ...live,
          syncQueue: mergeFlushedQueue(live.syncQueue, sent, flushed),
          settings: withSettingsDefaults({
            ...live.settings,
            lastCloudFlushAt: new Date().toISOString(),
          }),
        });
      })().finally(() => {
        flushing = null;
      });
    }
    return flushing;
  },
  importBackupJson: (raw, password) => {
    const validated = resolveBackupInput(raw, password);
    if (!validated.ok) {
      return { ok: false, error: validated.error };
    }
    try {
      const parsed = validated.data;
      const current = liveSnapshot(get);
      const next: FinanceSnapshot = {
        ...emptySnapshot(current.profile.id),
        version: SCHEMA_VERSION,
        profile: {
          ...current.profile,
          ...(parsed.profile ?? {}),
          id: current.profile.id || parsed.profile?.id || 'local-user',
        },
        settings: withSettingsDefaults({
          ...current.settings,
          ...(parsed.settings ?? {}),
          userId: current.profile.id,
          pinHash: undefined,
        }),
        accounts: Array.isArray(parsed.accounts) ? parsed.accounts : current.accounts,
        transactions: Array.isArray(parsed.transactions)
          ? parsed.transactions
          : current.transactions,
        budgets: Array.isArray(parsed.budgets) ? parsed.budgets : current.budgets,
        budgetCategories: Array.isArray(parsed.budgetCategories)
          ? parsed.budgetCategories
          : current.budgetCategories,
        goals: Array.isArray(parsed.goals) ? parsed.goals : current.goals ?? [],
        recurring: Array.isArray(parsed.recurring) ? parsed.recurring : current.recurring ?? [],
        rules: Array.isArray(parsed.rules) ? parsed.rules : current.rules,
        transfers: Array.isArray(parsed.transfers) ? parsed.transfers : current.transfers,
        unknownSms: current.unknownSms,
        netWorthHistory: Array.isArray(parsed.netWorthHistory)
          ? parsed.netWorthHistory
          : current.netWorthHistory,
        syncQueue: current.syncQueue,
      };
      const linked = relink(next, next.transactions);
      persistSet(set, linked);
      applyUserTheme({
        theme: linked.settings.theme,
        accentId: linked.settings.accentId,
      });
      return { ok: true };
    } catch {
      return { ok: false, error: 'parse' };
    }
  },
  enqueueFullUpload: () => {
    const snapshot = liveSnapshot(get);
    let queue = snapshot.syncQueue;
    for (const account of snapshot.accounts) {
      if (!account.id.startsWith('guest_')) {
        queue = enqueueSync(
          queue,
          createQueueItem('financial_accounts', account.id, 'upsert', account),
        );
      }
    }
    for (const tx of snapshot.transactions) {
      if (!isGuestFingerprint(tx.fingerprint, tx.id)) {
        queue = enqueueSync(queue, createQueueItem('transactions', tx.id, 'upsert', tx));
      }
    }
    persistSet(set, { ...snapshot, syncQueue: queue });
  },
  restoreFromCloud: async () => {
    const pulled = await pullCloudRecords();
    if (!pulled.ok) {
      return pulled;
    }
    // Merge onto the snapshot as it is after the network call.
    const live = clearGuestPreview(liveSnapshot(get));
    const accountIds = new Set(live.accounts.map(a => a.id));
    const txIds = new Set(live.transactions.map(tx => tx.id));
    const smsIds = new Set(
      live.transactions.map(tx => tx.sourceSmsId).filter((id): id is string => Boolean(id)),
    );
    const newAccounts = pulled.records.accounts.filter(a => !accountIds.has(a.id));
    const newTxs = pulled.records.transactions.filter(
      tx => !txIds.has(tx.id) && !(tx.sourceSmsId && smsIds.has(tx.sourceSmsId)),
    );
    if (newAccounts.length === 0 && newTxs.length === 0) {
      return { ok: true, addedTransactions: 0, addedAccounts: 0 };
    }
    const transactions = [...newTxs, ...live.transactions].sort(
      (a, b) => Date.parse(b.transactionDate) - Date.parse(a.transactionDate),
    );
    const touched = [...new Set(newTxs.map(tx => tx.accountId))];
    const accounts = recomputeSmsBalancesFor(
      [...live.accounts, ...newAccounts],
      transactions,
      touched,
    );
    persistSet(set, appendNetWorthPoint({ ...relink(live, transactions), accounts }));
    return { ok: true, addedTransactions: newTxs.length, addedAccounts: newAccounts.length };
  },
  refreshWealthPrices: async () => {
    const priced = liveSnapshot(get).accounts;
    const { accounts: nextAccounts, updated } = await refreshPricesFromHoldings(priced, {
      force: true,
    });
    if (updated === 0) {
      return 0;
    }
    // Apply only the repriced accounts, onto the snapshot as it is after the fetch.
    // An account edited or deleted meanwhile keeps the user's version.
    const repriced = new Map<string, { before: FinancialAccount; after: FinancialAccount }>();
    nextAccounts.forEach((after, index) => {
      if (after !== priced[index]) {
        repriced.set(after.id, { before: priced[index], after });
      }
    });
    const live = liveSnapshot(get);
    let applied = 0;
    const accounts = live.accounts.map(a => {
      const hit = repriced.get(a.id);
      if (hit && hit.before === a) {
        applied += 1;
        return hit.after;
      }
      return a;
    });
    if (applied > 0) {
      persistSet(set, appendNetWorthPoint({ ...live, accounts }));
    }
    return applied;
  },
}));

/**
 * The SMS transaction a manual entry would duplicate (same amount and direction within
 * 48 h, compatible merchant), if any. SMS-vs-SMS and transfers never count.
 */
export function findSmsDuplicateOf(
  transactions: Transaction[],
  tx: Transaction,
): Transaction | undefined {
  if (tx.source !== 'manual') {
    return undefined;
  }
  const hit = findCrossSourceDuplicate(transactions, tx);
  return hit?.source === 'android_sms' ? hit : undefined;
}

export function selectMonthStats(snapshot: MonthWindowInput, now = new Date()) {
  return monthlyTotals(financialMonthTransactions(snapshot, 0, now));
}

export function selectReviewItems(snapshot: Pick<FinanceSnapshot, 'transactions' | 'unknownSms'>): {
  transactions: Transaction[];
  unknown: UnknownSmsRecord[];
} {
  return {
    transactions: snapshot.transactions.filter(t => t.needsReview && !t.isConfirmed),
    unknown: snapshot.unknownSms,
  };
}
