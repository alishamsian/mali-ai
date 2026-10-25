import { detectBank } from '../detectors/bankDetector';
import { preprocessSms } from '../normalizer/preprocess';
import { collectSenderCandidates, groupByFormat } from '../discovery/formatDiscovery';
import type { RawSmsPayload } from '../ingest';
import { collectBankSenderSms } from './bankSenderScan';
import type { NormalizedInboxSms } from '../native/SmsModule';

export type HistoricalImportOptions = {
  /** @deprecated Prefer calendar-month window; kept for tests */
  days?: number;
  batchSize?: number;
  afterTimestampMs?: number;
  forceFull?: boolean;
};

export type HistoricalImportProgress = {
  phase: 'counting' | 'scanning' | 'done' | 'cancelled' | 'error';
  percent: number;
  scanned: number;
  total: number;
  bankHits: number;
  transactions: number;
  duplicates: number;
  unknown: number;
  nonTransactional?: number;
  message?: string;
  perSenderCounts?: Record<string, number>;
};

export type HistoricalImportResult = HistoricalImportProgress & {
  senderCandidates: ReturnType<typeof collectSenderCandidates>;
  formatGroups: ReturnType<typeof groupByFormat>;
  lastImportedSmsId?: string;
  lastImportedTimestamp?: number;
};

export type IngestFn = (payload: RawSmsPayload) => {
  kind: string;
};

/**
 * Full Historical Scan window:
 * previous calendar month 00:00:00 (local) → exact scan start time.
 */
export function historicalWindowMs(
  _daysIgnored?: number,
  nowMs = Date.now(),
): { minDateMs: number; maxDateMs: number } {
  const now = new Date(nowMs);
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
  return {
    minDateMs: start.getTime(),
    maxDateMs: nowMs,
  };
}

/**
 * Full historical SMS import — ONLY user-verified senders.
 */
export async function runHistoricalSmsImport(input: {
  options?: HistoricalImportOptions;
  ingest: IngestFn;
  /** User-verified sender strings (authoritative) */
  verifiedSenders: string[];
  onProgress?: (p: HistoricalImportProgress) => void;
  isCancelled?: () => boolean;
  collectRows?: (range: {
    minDateMs: number;
    maxDateMs: number;
  }) => Promise<{ rows: NormalizedInboxSms[]; perSenderCounts: Record<string, number> }>;
}): Promise<HistoricalImportResult> {
  const batchSize = input.options?.batchSize ?? 200;
  const { minDateMs, maxDateMs } = historicalWindowMs(input.options?.days);
  const afterMs =
    !input.options?.forceFull && input.options?.afterTimestampMs
      ? Math.max(minDateMs, input.options.afterTimestampMs + 1)
      : minDateMs;

  const emit = (p: HistoricalImportProgress) => input.onProgress?.(p);
  const senders = input.verifiedSenders ?? [];

  emit({
    phase: 'counting',
    percent: 0,
    scanned: 0,
    total: 0,
    bankHits: 0,
    transactions: 0,
    duplicates: 0,
    unknown: 0,
    nonTransactional: 0,
    message: 'در حال بررسی پیامک‌های بانکی...',
  });

  if (senders.length === 0) {
    const empty: HistoricalImportResult = {
      phase: 'done',
      percent: 100,
      scanned: 0,
      total: 0,
      bankHits: 0,
      transactions: 0,
      duplicates: 0,
      unknown: 0,
      nonTransactional: 0,
      senderCandidates: [],
      formatGroups: [],
      message: 'ابتدا سرشماره بانک را تأیید کنید',
    };
    emit(empty);
    return empty;
  }

  if (input.isCancelled?.()) {
    const cancelled: HistoricalImportResult = {
      phase: 'cancelled',
      percent: 0,
      scanned: 0,
      total: 0,
      bankHits: 0,
      transactions: 0,
      duplicates: 0,
      unknown: 0,
      senderCandidates: [],
      formatGroups: [],
      message: 'لغو شد — تراکنش‌های قبلی حفظ شدند',
    };
    emit(cancelled);
    return cancelled;
  }

  let rows: NormalizedInboxSms[] = [];
  let perSenderCounts: Record<string, number> = {};

  try {
    if (input.collectRows) {
      const collected = await input.collectRows({ minDateMs: afterMs, maxDateMs });
      rows = collected.rows;
      perSenderCounts = collected.perSenderCounts;
    } else {
      const collected = await collectBankSenderSms({
        minDateMs: afterMs,
        maxDateMs,
        senders,
        pageSize: batchSize,
        onProgress: p => {
          emit({
            phase: 'scanning',
            percent: 10,
            scanned: p.scannedForSender,
            total: 0,
            bankHits: 0,
            transactions: 0,
            duplicates: 0,
            unknown: 0,
            message: `در حال خواندن ${p.sender}...`,
            perSenderCounts,
          });
        },
      });
      rows = collected.rows;
      perSenderCounts = collected.perSenderCounts;
    }
  } catch {
    const err: HistoricalImportResult = {
      phase: 'error',
      percent: 0,
      scanned: 0,
      total: 0,
      bankHits: 0,
      transactions: 0,
      duplicates: 0,
      unknown: 0,
      senderCandidates: [],
      formatGroups: [],
      message: 'خواندن صندوق پیامک ناموفق بود',
    };
    emit(err);
    return err;
  }

  const total = rows.length;
  let scanned = 0;
  let bankHits = 0;
  let transactions = 0;
  let duplicates = 0;
  let unknown = 0;
  let nonTransactional = 0;
  let lastImportedSmsId: string | undefined;
  let lastImportedTimestamp: number | undefined;
  const bankBodies: Array<{ bankId: string; body: string; sender: string }> = [];

  for (const row of rows) {
    if (input.isCancelled?.()) {
      const cancelled: HistoricalImportResult = {
        phase: 'cancelled',
        percent: total > 0 ? Math.round((scanned / total) * 100) : 0,
        scanned,
        total,
        bankHits,
        transactions,
        duplicates,
        unknown,
        nonTransactional,
        perSenderCounts,
        senderCandidates: collectSenderCandidates(bankBodies),
        formatGroups: groupByFormat(bankBodies),
        lastImportedSmsId,
        lastImportedTimestamp,
        message: 'لغو شد — تراکنش‌های قبلی حفظ شدند',
      };
      emit(cancelled);
      return cancelled;
    }

    scanned += 1;
    const ts = Date.parse(row.receivedAt);
    if (!Number.isNaN(ts)) {
      if (lastImportedTimestamp == null || ts > lastImportedTimestamp) {
        lastImportedTimestamp = ts;
        lastImportedSmsId = row.sourceSmsId;
      }
    }

    bankHits += 1;
    const normalized = preprocessSms({
      sender: row.sender,
      body: row.body,
      receivedAt: row.receivedAt,
    });
    const detection = detectBank(normalized);
    if (detection.matched && detection.bankId) {
      bankBodies.push({ bankId: detection.bankId, body: row.body, sender: row.sender });
    }

    const result = input.ingest({
      sender: row.sender,
      body: row.body,
      receivedAt: row.receivedAt,
      sourceSmsId: row.sourceSmsId,
    });

    if (result.kind === 'duplicate') {
      duplicates += 1;
    } else if (result.kind === 'unknown') {
      unknown += 1;
    } else if (result.kind === 'non_transactional') {
      nonTransactional += 1;
    } else if (
      result.kind === 'created' ||
      result.kind === 'review' ||
      result.kind === 'pending' ||
      result.kind === 'merged' ||
      result.kind === 'updated'
    ) {
      transactions += 1;
    }

    if (scanned % 25 === 0 || scanned === total) {
      emit({
        phase: 'scanning',
        percent: total > 0 ? Math.min(99, Math.round((scanned / total) * 100)) : 50,
        scanned,
        total,
        bankHits,
        transactions,
        duplicates,
        unknown,
        nonTransactional,
        perSenderCounts,
        message: 'در حال بررسی پیامک‌های بانکی...',
      });
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
  }

  const done: HistoricalImportResult = {
    phase: 'done',
    percent: 100,
    scanned,
    total,
    bankHits,
    transactions,
    duplicates,
    unknown,
    nonTransactional,
    perSenderCounts,
    senderCandidates: collectSenderCandidates(bankBodies),
    formatGroups: groupByFormat(bankBodies),
    lastImportedSmsId,
    lastImportedTimestamp,
    message: 'اسکن تاریخی تکمیل شد',
  };
  emit(done);
  return done;
}
