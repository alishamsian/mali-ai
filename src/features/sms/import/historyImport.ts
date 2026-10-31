import { useFinanceStore } from '../../../store/finance/store';
import { financialMonthStart } from '../../../engine/insights/monthPeriod';
import { normalizeSmsSender } from '../senders/normalize';
import { readSenderSamples } from '../native/SmsModule';
import { collectBankSenderSms } from './bankSenderScan';
import { detectBankSenders, type DetectedBankSender } from '../setup/detectBanks';

const YIELD_EVERY = 60;
const DAY_MS = 86_400_000;
/** Banks that have not texted in a year are not worth offering. */
const DETECT_LOOKBACK_MS = 365 * DAY_MS;
const nextFrame = () => new Promise<void>(resolve => setTimeout(resolve, 0));

/** First run imports the current financial month, then the two before it in the background. */
export function initialImportWindow(now = new Date()) {
  const snapshot = useFinanceStore.getState().snapshot;
  return {
    currentFromMs: financialMonthStart(snapshot, now).getTime(),
    historyFromMs: financialMonthStart(snapshot, now, -2).getTime(),
  };
}

/**
 * Finds bank senders from a few newest messages per sender instead of every message in
 * the inbox, so a phone with tens of thousands of SMS answers in seconds. Counts are the
 * sender's messages inside the import window, scaled by how many samples looked like
 * transactions.
 */
export async function detectBanksQuickly(now = Date.now()): Promise<DetectedBankSender[]> {
  const { historyFromMs } = initialImportWindow(new Date(now));
  const groups = await readSenderSamples({
    minDateMs: now - DETECT_LOOKBACK_MS,
    recentFromMs: historyFromMs,
  });
  const recent = new Map<string, number>();
  for (const group of groups) {
    const key = normalizeSmsSender(group.sender);
    if (key) {
      recent.set(key, (recent.get(key) ?? 0) + group.recentCount);
    }
  }
  return detectBankSenders(groups.flatMap(g => g.rows)).map(found => ({
    ...found,
    transactionCount: Math.round(
      ((recent.get(found.sender) ?? 0) * found.transactionCount) / Math.max(1, found.totalCount),
    ),
  }));
}

export type BankSmsImportResult = { created: number; review: number; total: number };

/** Imports bank SMS from `senders` in [fromMs, toMs], oldest first, as one SMS batch. */
export async function importBankSms(input: {
  senders: string[];
  fromMs: number;
  toMs: number;
  onProgress?: (done: number, total: number) => void;
}): Promise<BankSmsImportResult> {
  const { rows } = await collectBankSenderSms({
    minDateMs: input.fromMs,
    maxDateMs: input.toMs,
    senders: input.senders,
  });
  // Oldest first; the batch end re-reads each account's newest bank-reported balance.
  rows.sort((a, b) => Date.parse(a.receivedAt) - Date.parse(b.receivedAt));
  input.onProgress?.(0, rows.length);
  let created = 0;
  let review = 0;
  useFinanceStore.getState().beginSmsBatch();
  try {
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const result = useFinanceStore.getState().ingestSms(
        {
          sender: row.sender,
          body: row.body,
          receivedAt: row.receivedAt,
          sourceSmsId: row.sourceSmsId,
        },
        { mode: 'incremental' },
      );
      if (result.kind === 'created') {
        created += 1;
      } else if (result.kind === 'review' || result.kind === 'pending') {
        review += 1;
      }
      if (i % YIELD_EVERY === 0) {
        input.onProgress?.(i + 1, rows.length);
        await nextFrame();
      }
    }
  } finally {
    useFinanceStore.getState().endSmsBatch();
  }
  input.onProgress?.(rows.length, rows.length);
  return { created, review, total: rows.length };
}

let backgroundRunning = false;

/**
 * Fills in older history after the user is already in the app. Shows as an SMS scan in
 * progress; one at a time, and repeated SMS are skipped by their source id.
 */
export async function importInBackground(input: {
  senders: string[];
  fromMs: number;
  toMs: number;
  message: string;
}): Promise<BankSmsImportResult | null> {
  if (backgroundRunning || input.senders.length === 0 || input.fromMs >= input.toMs) {
    return null;
  }
  backgroundRunning = true;
  const setSync = (status: 'scanning' | 'idle', message?: string) =>
    useFinanceStore.setState(state => ({
      smsSync: { ...state.smsSync, status, mode: null, message },
    }));
  setSync('scanning', input.message);
  try {
    return await importBankSms(input);
  } catch {
    return null;
  } finally {
    backgroundRunning = false;
    setSync('idle');
  }
}

/** Canonical senders the user has already confirmed, across all banks. */
export function verifiedSenders(): string[] {
  const connections = useFinanceStore.getState().snapshot.settings.bankConnections ?? [];
  return [...new Set(connections.flatMap(c => c.verifiedSenders.map(s => s.sender)))];
}
