import { sanitizeSmsText } from '../privacy/sanitize';
import { classifySmsBody, isSuitableForSenderVerification } from './classify';
import { normalizeSmsSender } from './normalize';
import { readInboxBatch, type NormalizedInboxSms } from '../native/SmsModule';

export type PickerSmsItem = {
  sourceSmsId?: string;
  sender: string;
  senderDisplay: string;
  receivedAt: string;
  preview: string;
  transactionLike: boolean;
  body: string;
};

const PICKER_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;

export async function loadSmsPickerCandidates(input?: {
  showAll?: boolean;
  nowMs?: number;
  readBatch?: typeof readInboxBatch;
}): Promise<PickerSmsItem[]> {
  const now = input?.nowMs ?? Date.now();
  const read = input?.readBatch ?? readInboxBatch;
  const minDateMs = now - PICKER_LOOKBACK_MS;
  const rows: NormalizedInboxSms[] = [];
  let offset = 0;
  const pageSize = 100;
  // Cap picker UI to ~400 recent messages (not a sync limit)
  while (offset < 400) {
    const page = await read({
      minDateMs,
      maxDateMs: now,
      offset,
      limit: pageSize,
    });
    if (page.length === 0) {
      break;
    }
    rows.push(...page);
    offset += page.length;
    if (page.length < pageSize) {
      break;
    }
  }

  // Newest first for picker
  rows.sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt));

  const mapped = rows.map(row => {
    const { sanitized } = sanitizeSmsText(row.body);
    const cls = classifySmsBody(row.body);
    return {
      sourceSmsId: row.sourceSmsId,
      sender: normalizeSmsSender(row.sender),
      senderDisplay: row.sender.trim(),
      receivedAt: row.receivedAt,
      preview: sanitized.slice(0, 120),
      transactionLike: cls === 'transaction_candidate' || isSuitableForSenderVerification(row.body),
      body: row.body,
    } satisfies PickerSmsItem;
  });

  if (input?.showAll) {
    return mapped;
  }
  const preferred = mapped.filter(m => m.transactionLike);
  // Soft rank: show preferred first, but keep a fallback slice of others
  const others = mapped.filter(m => !m.transactionLike).slice(0, 40);
  return [...preferred, ...others];
}
