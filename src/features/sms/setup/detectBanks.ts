import type { NormalizedInboxSms } from '../native/SmsModule';
import { classifySmsBody } from '../senders/classify';
import { normalizeSmsSender } from '../senders/normalize';
import { matchBankIdBySender } from '../registry/senders';
import { detectBank } from '../detectors/bankDetector';

export type DetectedBankSender = {
  bankId: string;
  /** Normalized sender, the key the verified-sender list stores. */
  sender: string;
  /** Sender as the phone shows it. */
  senderDisplay: string;
  transactionCount: number;
  totalCount: number;
  lastAt: string;
};

/** Bodies sampled per sender when the sender id alone does not name the bank. */
const BODY_SAMPLES = 5;

/**
 * Finds the bank senders in an inbox: senders with at least one transaction-like
 * message, named by their known sender id or, failing that, by the bank most of their
 * transaction messages look like. Biggest senders first.
 */
export function detectBankSenders(rows: NormalizedInboxSms[]): DetectedBankSender[] {
  const groups = new Map<string, { display: string; rows: NormalizedInboxSms[] }>();
  for (const row of rows) {
    const sender = normalizeSmsSender(row.sender);
    if (!sender) {
      continue;
    }
    const group = groups.get(sender) ?? { display: row.sender.trim(), rows: [] };
    group.rows.push(row);
    groups.set(sender, group);
  }

  const out: DetectedBankSender[] = [];
  for (const [sender, group] of groups) {
    const transactional = group.rows.filter(r => classifySmsBody(r.body) === 'transaction_candidate');
    if (transactional.length === 0) {
      continue;
    }
    const bankId = matchBankIdBySender(group.display) ?? matchBankIdBySender(sender) ?? bankFromBodies(transactional);
    if (!bankId) {
      continue;
    }
    out.push({
      bankId,
      sender,
      senderDisplay: group.display,
      transactionCount: transactional.length,
      totalCount: group.rows.length,
      lastAt: group.rows.reduce((max, r) => (r.receivedAt > max ? r.receivedAt : max), ''),
    });
  }
  return out.sort((a, b) => b.transactionCount - a.transactionCount);
}

function bankFromBodies(rows: NormalizedInboxSms[]): string | undefined {
  const votes = new Map<string, number>();
  for (const row of rows.slice(0, BODY_SAMPLES)) {
    const result = detectBank({
      sender: row.sender,
      body: row.body,
      receivedAt: row.receivedAt,
      originalLength: row.body.length,
    });
    if (result.matched && result.bankId) {
      votes.set(result.bankId, (votes.get(result.bankId) ?? 0) + 1);
    }
  }
  let best: string | undefined;
  let bestVotes = 0;
  for (const [bankId, n] of votes) {
    if (n > bestVotes) {
      best = bankId;
      bestVotes = n;
    }
  }
  return best;
}
