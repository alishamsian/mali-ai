import {
  readBankSenderBatch,
  type NormalizedInboxSms,
} from '../native/SmsModule';

export const BANK_SENDER_PAGE_SIZE = 200;

export type BankSenderScanProgress = {
  sender: string;
  scannedForSender: number;
};

/**
 * Fetch ALL SMS from the given senders in [minDateMs, maxDateMs].
 * No body keyword filter. No total message cap.
 * Callers MUST pass user-verified senders (not a global hardcoded list).
 */
export async function collectBankSenderSms(input: {
  minDateMs: number;
  maxDateMs: number;
  senders: string[];
  pageSize?: number;
  readBatch?: (args: {
    sender: string;
    minDateMs: number;
    maxDateMs: number;
    offset: number;
    limit: number;
  }) => Promise<NormalizedInboxSms[]>;
  onProgress?: (p: BankSenderScanProgress) => void;
}): Promise<{
  rows: NormalizedInboxSms[];
  perSenderCounts: Record<string, number>;
}> {
  const senders = input.senders.filter(Boolean);
  const pageSize = input.pageSize ?? BANK_SENDER_PAGE_SIZE;
  const read = input.readBatch ?? readBankSenderBatch;
  const byId = new Map<string, NormalizedInboxSms>();
  const perSenderCounts: Record<string, number> = {};

  if (senders.length === 0) {
    return { rows: [], perSenderCounts };
  }

  for (const sender of senders) {
    let offset = 0;
    let senderCount = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const page = await read({
        sender,
        minDateMs: input.minDateMs,
        maxDateMs: input.maxDateMs,
        offset,
        limit: pageSize,
      });
      if (page.length === 0) {
        break;
      }
      for (const row of page) {
        senderCount += 1;
        const key = row.sourceSmsId ?? `${row.sender}|${row.receivedAt}|${row.body.slice(0, 64)}`;
        if (!byId.has(key)) {
          byId.set(key, row);
        }
      }
      offset += page.length;
      input.onProgress?.({ sender, scannedForSender: senderCount });
      // Yield every few pages — not after every page
      if (Math.floor(offset / pageSize) % 3 === 0) {
        await new Promise<void>(resolve => setTimeout(resolve, 0));
      }
      if (page.length < pageSize) {
        break;
      }
    }
    perSenderCounts[sender] = senderCount;
  }

  const rows = [...byId.values()].sort((a, b) => {
    const ta = Date.parse(a.receivedAt);
    const tb = Date.parse(b.receivedAt);
    if (ta !== tb) {
      return ta - tb;
    }
    return String(a.sourceSmsId ?? '').localeCompare(String(b.sourceSmsId ?? ''), undefined, {
      numeric: true,
    });
  });

  return { rows, perSenderCounts };
}
