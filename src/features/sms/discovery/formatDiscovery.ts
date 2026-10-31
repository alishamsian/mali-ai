import { patternHashFor } from '../validators/unknown';

export type FormatGroup = {
  bankId: string;
  patternHash: string;
  formatId: string;
  count: number;
};

export type SenderCandidate = {
  sender: string;
  bankId?: string;
  count: number;
  verified: false;
};

export function formatIdFromHash(patternHash: string): string {
  return `format-${patternHash.slice(0, 8)}`;
}

export function groupByFormat(items: Array<{ bankId: string; body: string }>): FormatGroup[] {
  const map = new Map<string, FormatGroup>();
  for (const item of items) {
    const patternHash = patternHashFor(item.body);
    const key = `${item.bankId}:${patternHash}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(key, {
        bankId: item.bankId,
        patternHash,
        formatId: formatIdFromHash(patternHash),
        count: 1,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export function collectSenderCandidates(
  items: Array<{ sender: string; bankId?: string }>,
): SenderCandidate[] {
  const map = new Map<string, SenderCandidate>();
  for (const item of items) {
    const key = `${item.bankId ?? 'unknown'}:${item.sender}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(key, {
        sender: item.sender,
        bankId: item.bankId,
        count: 1,
        verified: false,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}
