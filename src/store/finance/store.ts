import { create } from 'zustand';
import type { FinanceSnapshot } from '../../database/schema/snapshot';
import { emptySnapshot } from '../../database/schema/snapshot';
import { stripSeededDemo } from '../../database/seed/stripDemo';
import {
  applyGuestPreview,
  clearGuestPreview,
  shouldOfferGuestPreview,
} from '../../database/seed/guestPreview';
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
import { createQueueItem } from '../../services/sync/queue';
import { monthlyTotals } from '../../engine/insights/analytics';
import { ruleFromCorrection } from '../../engine/category/engine';
import { ingestIncomingSms, recomputeAccountBalancesFromSms, type IngestSmsOptions, type RawSmsPayload } from '../../features/sms/ingest';
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
import { startOfJalaliMonth } from '../../utils/dates/jalali';
import { applyUserTheme } from '../../theme/runtime';
import { SCHEMA_VERSION } from '../../database/schema/snapshot';

const NAV_STATE_KEY = 'mali.nav.state.v1';

let db: LocalFinanceDb | null = null;
let hydrating: Promise<void> | null = null;

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

function persistSet(
  set: (partial: Partial<FinanceState>) => void,
  snapshot: FinanceSnapshot,
) {
  syncDisplayCurrency(snapshot.settings);
  requireDb().save(snapshot);
  set({ snapshot });
}

/** During batch: write working copy only. Outside: full persist. */
function commitSnapshot(
  set: (partial: Partial<FinanceState>) => void,
  snapshot: FinanceSnapshot,
) {
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
  storageError: { code: string } | null;
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
  addTransaction: (tx: Transaction) => void;
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
  restoreMerchantRule: (merchant: string, previous: FinanceSnapshot['rules'][number] | undefined) => void;
  flushCloud: () => Promise<void>;
  importBackupJson: (raw: string, password?: string) => { ok: true } | { ok: false; error: string };
  refreshWealthPrices: () => Promise<number>;
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
          set({ storageError: { code: (e as { code?: string })?.code ?? 'unknown' } });
          return;
        }
        set({ storageError: null });
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
    requireDb().save(get().snapshot);
  },
  wipeAllData: async () => {
    await clearPinHash();
    await clearVaultToken();
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
    const snapshot = get().snapshot;
    persistSet(set, {
      ...snapshot,
      settings: { ...snapshot.settings, hideBalances: !snapshot.settings.hideBalances },
    });
  },
  completeOnboarding: () => {
    const snapshot = get().snapshot;
    let next = {
      ...snapshot,
      settings: { ...snapshot.settings, onboardingCompleted: true },
    };
    if (shouldOfferGuestPreview(next)) {
      next = applyGuestPreview(next);
    }
    persistSet(set, next);
  },
  addTransaction: (tx: Transaction) => {
    const snapshot = liveSnapshot(get);
    const hit = findCrossSourceDuplicate(snapshot.transactions, tx);
    if (hit && tx.source === 'manual' && hit.source === 'android_sms') {
      return;
    }
    if (tx.source === 'android_sms' && hit?.source === 'android_sms') {
      // fall through
    }
    const nextTxs = [tx, ...snapshot.transactions];
    if (tx.sourceSmsId && smsBatchSourceIds) {
      smsBatchSourceIds.add(tx.sourceSmsId);
    }
    if (isSmsBatching()) {
      // Defer transfer-link + authoritative balance recompute until endSmsBatch
      commitSnapshot(set, {
        ...snapshot,
        transactions: nextTxs,
        accounts: applyBalance(snapshot.accounts, tx),
        syncQueue: [...snapshot.syncQueue, createQueueItem('transactions', tx.id, 'upsert', tx)],
      });
      return;
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
      syncQueue: [...snapshot.syncQueue, createQueueItem('transactions', tx.id, 'upsert', tx)],
    });
  },
  deleteTransaction: id => {
    const snapshot = get().snapshot;
    const tx = snapshot.transactions.find(item => item.id === id);
    if (!tx) {
      return;
    }
    const nextTxs = snapshot.transactions.filter(item => item.id !== id);
    persistSet(set, {
      ...relink(snapshot, nextTxs),
      accounts: reverseBalance(snapshot.accounts, tx),
      syncQueue: [...snapshot.syncQueue, createQueueItem('transactions', id, 'delete', { id })],
    });
  },
  updateTransaction: (id, patch) => {
    const snapshot = get().snapshot;
    const transactions = snapshot.transactions.map(tx =>
      tx.id === id ? { ...tx, ...patch, updatedAt: new Date().toISOString() } : tx,
    );
    persistSet(set, relink(snapshot, transactions));
  },
  confirmTransaction: id => {
    get().updateTransaction(id, { isConfirmed: true, needsReview: false, confidence: 1 });
  },
  recategorizeTransaction: (id, categoryId) => {
    const snapshot = get().snapshot;
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
    const snapshot = get().snapshot;
    const settings = withSettingsDefaults({ ...snapshot.settings, ...patch });
    persistSet(set, { ...snapshot, settings });
    if (patch.bankConnections != null || patch.selectedBankIds != null) {
      pushVerifiedSendersToNative(settings);
    }
  },
  verifyBankSender: ({ bankId, sender, method = 'user_selected_sms' }) => {
    const snapshot = get().snapshot;
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
    const snapshot = get().snapshot;
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
    const snapshot = get().snapshot;
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
        syncQueue: [
          ...snapshot.syncQueue,
          createQueueItem('financial_accounts', nextAccount.id, 'upsert', nextAccount),
        ],
      });
      return;
    }
    const withHistory = appendNetWorthPoint({ ...snapshot, accounts: nextAccounts });
    persistSet(set, {
      ...withHistory,
      syncQueue: [
        ...snapshot.syncQueue,
        createQueueItem('financial_accounts', nextAccount.id, 'upsert', nextAccount),
      ],
    });
  },
  deleteAccount: id => {
    const snapshot = get().snapshot;
    const nextAccounts = snapshot.accounts.filter(a => a.id !== id);
    const withHistory = appendNetWorthPoint({ ...snapshot, accounts: nextAccounts });
    persistSet(set, {
      ...withHistory,
      syncQueue: [...snapshot.syncQueue, createQueueItem('financial_accounts', id, 'delete', { id })],
    });
  },
  upsertBudget: (budget, categories) => {
    const snapshot = get().snapshot;
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
    const snapshot = get().snapshot;
    persistSet(set, {
      ...snapshot,
      goals: [...snapshot.goals.filter(g => g.id !== goal.id), goal],
    });
  },
  deleteGoal: id => {
    const snapshot = get().snapshot;
    persistSet(set, { ...snapshot, goals: snapshot.goals.filter(g => g.id !== id) });
  },
  contributeGoal: (id, amountRial) => {
    const snapshot = get().snapshot;
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
    const snapshot = get().snapshot;
    persistSet(set, {
      ...snapshot,
      recurring: [...snapshot.recurring.filter(r => r.id !== item.id), item],
    });
  },
  deleteRecurring: id => {
    const snapshot = get().snapshot;
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
      get().updateTransaction(result.transaction.id, {
        transactionDate: result.transaction.transactionDate,
      });
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
    const snapshot = get().snapshot;
    persistSet(set, { ...snapshot, unknownSms: snapshot.unknownSms.filter(u => u.id !== id) });
  },
  clearUnknownSms: () => {
    const snapshot = get().snapshot;
    persistSet(set, { ...snapshot, unknownSms: [] });
  },
  dismissFirstSmsWin: () => {
    const snapshot = get().snapshot;
    persistSet(set, {
      ...snapshot,
      settings: { ...snapshot.settings, firstSmsWinDismissed: true, firstSmsWinReady: false },
    });
  },
  dismissGuestPreview: () => {
    const snapshot = get().snapshot;
    persistSet(set, clearGuestPreview(snapshot));
  },
  joinProWaitlist: () => {
    const snapshot = get().snapshot;
    persistSet(set, {
      ...snapshot,
      settings: { ...snapshot.settings, proWaitlistJoined: true },
    });
  },
  dismissMoment: id => {
    const snapshot = get().snapshot;
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
    const snapshot = get().snapshot;
    persistSet(set, {
      ...snapshot,
      settings: { ...snapshot.settings, lastMonthClosingKey: monthKey },
    });
  },
  dismissFirstCalmNight: () => {
    const snapshot = get().snapshot;
    persistSet(set, {
      ...snapshot,
      settings: { ...snapshot.settings, firstCalmNightDismissed: true },
    });
  },
  addCategoryRuleFromMerchant: (merchant, categoryId) => {
    const snapshot = get().snapshot;
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
    const snapshot = get().snapshot;
    const others = snapshot.rules.filter(r => r.matcher !== merchant.trim());
    persistSet(set, { ...snapshot, rules: previous ? [...others, previous] : others });
  },
  flushCloud: async () => {
    const snapshot = get().snapshot;
    const nextQueue = await flushSyncQueue(snapshot.syncQueue);
    persistSet(set, {
      ...get().snapshot,
      syncQueue: nextQueue,
      settings: withSettingsDefaults({
        ...get().snapshot.settings,
        lastCloudFlushAt: new Date().toISOString(),
      }),
    });
  },
  importBackupJson: (raw, password) => {
    const validated = resolveBackupInput(raw, password);
    if (!validated.ok) {
      return { ok: false, error: validated.error };
    }
    try {
      const parsed = validated.data;
      const current = get().snapshot;
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
  refreshWealthPrices: async () => {
    const snapshot = get().snapshot;
    const { accounts: nextAccounts, updated } = await refreshPricesFromHoldings(
      snapshot.accounts,
      { force: true },
    );
    if (updated > 0) {
      const withHistory = appendNetWorthPoint({ ...snapshot, accounts: nextAccounts });
      persistSet(set, withHistory);
    }
    return updated;
  },
}));

export function selectMonthStats(snapshot: FinanceSnapshot) {
  const settings = withSettingsDefaults(snapshot.settings);
  const startDay = Math.min(28, Math.max(1, settings.financialMonthStartDay ?? 1));
  const now = new Date();

  let start: Date;
  if (settings.calendar === 'gregorian') {
    start = new Date(now.getFullYear(), now.getMonth(), startDay, 0, 0, 0, 0);
    if (start.getTime() > now.getTime()) {
      start = new Date(now.getFullYear(), now.getMonth() - 1, startDay, 0, 0, 0, 0);
    }
  } else {
    const monthStart = startOfJalaliMonth(now.toISOString());
    start = new Date(monthStart);
    if (startDay > 1) {
      start.setDate(start.getDate() + (startDay - 1));
    }
    start.setHours(0, 0, 0, 0);
    if (start.getTime() > now.getTime()) {
      start.setMonth(start.getMonth() - 1);
    }
  }

  const monthTx = snapshot.transactions.filter(t => Date.parse(t.transactionDate) >= start.getTime());
  return monthlyTotals(monthTx);
}

export function selectReviewItems(snapshot: FinanceSnapshot): {
  transactions: Transaction[];
  unknown: UnknownSmsRecord[];
} {
  return {
    transactions: snapshot.transactions.filter(t => t.needsReview && !t.isConfirmed),
    unknown: snapshot.unknownSms,
  };
}
