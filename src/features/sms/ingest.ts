import type { FinanceSnapshot } from '../../database/schema/snapshot';
import type { FinancialAccount, Transaction } from '../../types/finance';
import { resolveBankName } from '../banks/names';
import { detectBank } from './detectors/bankDetector';
import { hasTransactionSignals } from './filters/financialCandidate';
import { preprocessSms } from './normalizer/preprocess';
import { runSmsPipeline, getSmsParserVersion } from './pipeline/run';
import { classifySmsBody, isNonTransactionalSms } from './senders/classify';
import { normalizeSmsSender } from './senders/normalize';
import {
  isVerifiedSender,
  matchVerifiedBankId,
  noteDiscoveredSender,
} from './senders/verified';
import { sanitizeSmsText } from './privacy/sanitize';
import { toUnknownRecord } from './validators/unknown';

export type RawSmsPayload = {
  sender: string;
  body: string;
  receivedAt?: string;
  sourceSmsId?: string;
};

/** Live = default filters. Incremental = recovery-safe. */
export type IngestSmsOptions = {
  mode?: 'live' | 'incremental';
  /** O(1) duplicate lookup during batch ingest */
  sourceSmsIdIndex?: Set<string>;
};

export type IngestSmsResult = {
  kind:
    | 'created'
    | 'review'
    | 'pending'
    | 'duplicate'
    | 'unknown'
    | 'ignored'
    | 'merged'
    | 'updated'
    | 'non_transactional';
  transaction?: Transaction;
  account?: FinancialAccount;
  unknown?: ReturnType<typeof runSmsPipeline>['unknown'];
  /** When an unverified sender was noted for discovery UI */
  discoveredSender?: string;
};


export function resolveAccountId(
  snapshot: FinanceSnapshot,
  bankId?: string,
  cardLast4?: string,
): string | undefined {
  if (cardLast4) {
    const byCard = snapshot.accounts.find(
      a => a.cardLast4 === cardLast4 && (!bankId || a.bankId === bankId),
    );
    if (byCard) {
      return byCard.id;
    }
  }
  if (bankId) {
    const byBank = snapshot.accounts.find(a => a.bankId === bankId);
    if (byBank) {
      return byBank.id;
    }
  }
  return undefined;
}

export function accountFromSms(input: {
  userId: string;
  bankId: string;
  cardLast4?: string;
  now: string;
}): FinancialAccount {
  const name = resolveBankName(input.bankId);
  return {
    id: `acc_sms_${input.bankId}_${input.cardLast4 ?? 'main'}`,
    userId: input.userId,
    kind: 'bank',
    bankId: input.bankId,
    name,
    cardLast4: input.cardLast4,
    balanceRial: 0,
    lastSyncAt: input.now,
    transactionCount: 0,
    createdAt: input.now,
    updatedAt: input.now,
    assetClass: 'bank',
    liquidity: 'high',
    priceSource: 'manual',
    costBasisRial: 0,
    liabilityRial: 0,
    details: {
      class: 'bank',
      bankId: input.bankId,
      accountTitle: name,
      cardLast4: input.cardLast4,
      currency: 'IRT',
      accountType: 'checking',
    },
  };
}

/**
 * Recompute each account's balanceRial from the latest SMS that carries balanceAfterRial.
 * Single pass over transactions — O(n) not O(n·accounts).
 */
export function recomputeAccountBalancesFromSms(
  accounts: FinancialAccount[],
  transactions: Transaction[],
): FinancialAccount[] {
  type Best = { balance: number; dateMs: number; smsId: string; updatedAt: string };
  const bestByAccount = new Map<string, Best>();

  for (const tx of transactions) {
    if (tx.source !== 'android_sms' || typeof tx.balanceAfterRial !== 'number') {
      continue;
    }
    const dateMs = Date.parse(tx.transactionDate);
    const smsId = String(tx.sourceSmsId ?? '');
    const prev = bestByAccount.get(tx.accountId);
    if (!prev) {
      bestByAccount.set(tx.accountId, {
        balance: tx.balanceAfterRial,
        dateMs,
        smsId,
        updatedAt: tx.updatedAt,
      });
      continue;
    }
    if (
      dateMs > prev.dateMs ||
      (dateMs === prev.dateMs &&
        smsId.localeCompare(prev.smsId, undefined, { numeric: true }) > 0)
    ) {
      bestByAccount.set(tx.accountId, {
        balance: tx.balanceAfterRial,
        dateMs,
        smsId,
        updatedAt: tx.updatedAt,
      });
    }
  }

  return accounts.map(account => {
    const latest = bestByAccount.get(account.id);
    if (!latest) {
      return account;
    }
    return {
      ...account,
      balanceRial: latest.balance,
      updatedAt: latest.updatedAt,
    };
  });
}

export function ingestIncomingSms(
  snapshot: FinanceSnapshot,
  payload: RawSmsPayload,
  options?: IngestSmsOptions,
): IngestSmsResult {
  if (!snapshot.settings.smsProcessingEnabled) {
    return { kind: 'ignored' };
  }
  const receivedAt = payload.receivedAt ?? new Date().toISOString();
  const senderNorm = normalizeSmsSender(payload.sender);
  const verified = matchVerifiedBankId(snapshot.settings, payload.sender);

  // PRIMARY duplicate key for inbox SMS
  if (payload.sourceSmsId) {
    const hit = options?.sourceSmsIdIndex
      ? options.sourceSmsIdIndex.has(payload.sourceSmsId)
      : snapshot.transactions.some(tx => tx.sourceSmsId === payload.sourceSmsId);
    if (hit) {
      return { kind: 'duplicate' };
    }
  }

  // AUTHORITATIVE GATE: only user-verified (or migrated legacy) senders enter bank pipeline
  if (!verified) {
    const discovered = noteDiscoveredSender(
      snapshot.settings.discoveredSmsSenders,
      payload.sender,
    );
    // Soft note for discovery UI — do not parse as bank TX
    return {
      kind: 'ignored',
      discoveredSender:
        discovered.length > (snapshot.settings.discoveredSmsSenders?.length ?? 0)
          ? senderNorm
          : undefined,
    };
  }

  const bankId = verified.bankId;

  // SENDER AUTHORIZATION ≠ TRANSACTION CLASSIFICATION
  if (isNonTransactionalSms(payload.body) || classifySmsBody(payload.body) === 'non_transactional') {
    return { kind: 'non_transactional' };
  }

  const normalized = preprocessSms({
    sender: payload.sender,
    body: payload.body,
    receivedAt,
  });

  // Prefer verified mapping over heuristic detector
  let detection = detectBank(normalized);
  if (!detection.matched || detection.bankId !== bankId || detection.conflict) {
    detection = {
      matched: true,
      confidence: 1,
      bankId,
      conflict: false,
    };
  }

  let detected = runSmsPipeline({
    userId: snapshot.profile.id,
    accountId: snapshot.accounts[0]?.id ?? 'acc_pending',
    raw: { sender: payload.sender, body: payload.body, receivedAt },
    existing: snapshot.transactions,
    sourceSmsId: payload.sourceSmsId,
    forcedBankId: bankId,
  });

  if (detected.status === 'duplicate') {
    return { kind: 'duplicate' };
  }

  if (detected.status === 'unknown' || !detected.transaction) {
    // Verified sender + transactional-looking but unparsed → unknownSms (never ignore)
    if (hasTransactionSignals(normalized.body) || classifySmsBody(normalized.body) === 'transaction_candidate') {
      const unknown =
        detected.unknown ??
        toUnknownRecord({
          userId: snapshot.profile.id,
          sender: normalized.sender,
          bankId,
          body: normalized.body,
          parserVersion: getSmsParserVersion(),
          failureReason: detected.telemetry.failureReason ?? 'unknown_format',
          receivedAt,
          sourceSmsId: payload.sourceSmsId,
        });
      return { kind: 'unknown', unknown };
    }
    // Ambiguous / service message from verified sender — not a TX, not unknown review clutter
    return { kind: 'non_transactional' };
  }

  const now = new Date().toISOString();
  const existingId = resolveAccountId(
    snapshot,
    bankId,
    detected.transaction.cardLast4,
  );
  const account = existingId
    ? undefined
    : accountFromSms({
        userId: snapshot.profile.id,
        bankId,
        cardLast4: detected.transaction.cardLast4,
        now,
      });
  const accountId = existingId ?? account!.id;

  const idSeed = payload.sourceSmsId
    ? `sms${payload.sourceSmsId}`
    : `${detected.transaction.fingerprint.slice(0, 10)}_${Date.parse(receivedAt) || Date.now()}`;

  const transaction: Transaction = {
    ...detected.transaction,
    accountId,
    sourceSmsId: payload.sourceSmsId,
    sourceSmsPreview: sanitizeSmsText(normalized.body).sanitized.slice(0, 500),
    id: `tx_${idSeed}`,
    createdAt: now,
    updatedAt: now,
  };
  const kind =
    detected.status === 'created' ? 'created' : detected.status === 'pending' ? 'pending' : 'review';
  return { kind, transaction, account };
}

/** @deprecated Prefer isVerifiedSender from senders/verified */
export function isKnownBankSenderCompat(settings: FinanceSnapshot['settings'], sender: string): boolean {
  return isVerifiedSender(settings, sender);
}
