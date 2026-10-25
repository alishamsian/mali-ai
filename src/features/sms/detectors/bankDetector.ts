import type { DetectionResult, NormalizedSms } from '../types';
import { BANK_REGISTRY } from '../registry/banks';

export interface BankIdentity {
  bankId: string;
  senders: string[];
  /** Strong phrases (e.g. بانک ملت) — enough alone to match. */
  strongKeywords: string[];
  /** Weaker tokens — need sender or strong keyword too. */
  weakKeywords: string[];
}

/** Registry-driven identities; senders only from verified registry entries. */
export const KNOWN_BANKS: BankIdentity[] = BANK_REGISTRY.map(bank => ({
  bankId: bank.id,
  senders: bank.senders,
  strongKeywords: bank.strongKeywords,
  weakKeywords: bank.weakKeywords,
}));

const LEGACY_SENDER_HINTS: Record<string, string[]> = Object.fromEntries(
  BANK_REGISTRY.map(bank => [bank.id, bank.legacyAliases]),
);

function scoreBank(message: NormalizedSms, bank: BankIdentity): number {
  const sender = `${message.sender} ${message.senderName ?? ''}`.toLowerCase();
  let score = 0;
  const senders = [
    ...bank.senders,
    ...(LEGACY_SENDER_HINTS[bank.bankId] ?? []),
  ];
  if (senders.some(s => sender.includes(s.toLowerCase()))) {
    score += 0.7;
  }
  if (bank.strongKeywords.some(k => message.body.includes(k))) {
    score += 0.65;
  } else if (bank.weakKeywords.some(k => message.body.includes(k))) {
    score += 0.25;
  }
  return Math.min(score, 0.99);
}

export function detectBank(message: NormalizedSms): DetectionResult {
  const scored = KNOWN_BANKS.map(bank => ({
    bankId: bank.bankId,
    confidence: scoreBank(message, bank),
  })).sort((a, b) => b.confidence - a.confidence);

  const best = scored[0];
  const second = scored[1];
  if (!best || best.confidence < 0.6) {
    return {
      matched: false,
      confidence: best?.confidence ?? 0,
      bankId: best && best.confidence > 0 ? best.bankId : undefined,
    };
  }

  if (
    second &&
    second.confidence >= 0.6 &&
    Math.abs(best.confidence - second.confidence) <= 0.05
  ) {
    return {
      matched: false,
      confidence: best.confidence,
      bankId: best.bankId,
      conflict: true,
      conflictBanks: [
        { bankId: best.bankId, confidence: best.confidence },
        { bankId: second.bankId, confidence: second.confidence },
      ],
    };
  }

  return { matched: true, confidence: best.confidence, bankId: best.bankId };
}
