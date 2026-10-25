import { sha256 } from 'js-sha256';
import type { UnknownSmsRecord } from '../../../types/finance';
import { sanitizeSmsText } from '../privacy/sanitize';
import { formatIdFromHash } from '../discovery/formatDiscovery';

export function patternHashFor(body: string): string {
  const skeleton = body.replace(/\d/g, '0').replace(/[A-Za-z]/g, 'A').slice(0, 400);
  return sha256(skeleton);
}

export function toUnknownRecord(input: {
  userId: string;
  sender: string;
  bankId?: string;
  body: string;
  parserVersion: string;
  failureReason: string;
  receivedAt?: string;
  sourceSmsId?: string;
}): UnknownSmsRecord {
  const patternHash = patternHashFor(input.body);
  const { sanitized } = sanitizeSmsText(input.body);
  return {
    id: `unk_${Date.now()}_${patternHash.slice(0, 6)}`,
    userId: input.userId,
    bankId: input.bankId,
    sender: input.sender.slice(0, 32),
    patternHash,
    parserVersion: input.parserVersion,
    failureReason: input.failureReason,
    receivedAt: input.receivedAt ?? new Date().toISOString(),
    sanitizedMessage: sanitized.slice(0, 500),
    formatId: formatIdFromHash(patternHash),
    sourceSmsId: input.sourceSmsId,
  };
}
