import { toEnglishDigits } from '../../../utils/numbers/digits';
import type {
  Transaction,
  TransactionDirection,
  TransactionType,
  UnknownSmsRecord,
} from '../../../types/finance';
import { categorize } from '../../../engine/category/engine';
import { bandFor } from '../../../engine/confidence';
import { buildFingerprint, findFuzzyDuplicates, isExactDuplicate } from '../../../engine/duplicate/fingerprint';
import { detectBank } from '../detectors/bankDetector';
import { mellatParser } from '../banks/mellat/parser';
import { melliParser } from '../banks/melli/parser';
import { createUnimplementedParser } from '../banks/unimplemented';
import { parseGenericBankSms } from '../banks/generic/parser';
import { BANK_REGISTRY } from '../registry/banks';
import { preprocessSms, type RawSmsInput } from '../normalizer/preprocess';
import type { BankSmsParser, ParsedTransaction, ParserTelemetry } from '../types';
import { toUnknownRecord } from '../validators/unknown';

const PARSER_VERSION = '1.2.0';

export function getSmsParserVersion(): string {
  return PARSER_VERSION;
}

const IMPLEMENTED_PARSERS: Record<string, BankSmsParser> = {
  mellat: mellatParser,
  melli: melliParser,
};

const bankParsers: BankSmsParser[] = BANK_REGISTRY.map(
  bank => IMPLEMENTED_PARSERS[bank.id] ?? createUnimplementedParser(bank.id),
);

function directionFor(type: TransactionType, body: string): TransactionDirection {
  if (type === 'deposit' || type === 'refund' || type === 'reversal') {
    return 'in';
  }
  if (type === 'transfer') {
    // A bank transfer may go to someone else. Only a paired own-account move
    // is excluded from spending by transferId.
    // Banks mark the amount with a sign («۱,۵۰۰,۰۰۰+»); words are the fallback.
    const latin = toEnglishDigits(body);
    // Preprocessing drops thousands separators; 4+ digits keeps dates («0603-19:36») out.
    const amount = '\\d{4,}';
    if (new RegExp(`${amount}\\s*\\+|\\+\\s*${amount}`).test(latin)) {
      return 'in';
    }
    if (new RegExp(`${amount}\\s*-(?!\\d)|-\\s*${amount}`).test(latin)) {
      return 'out';
    }
    return /واریز|دریافت|به حساب شما/.test(body) ? 'in' : 'out';
  }
  return 'out';
}

export interface PipelineResult {
  status: 'created' | 'review' | 'pending' | 'duplicate' | 'unknown';
  transaction?: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>;
  unknown?: UnknownSmsRecord;
  telemetry: ParserTelemetry;
}

export function runSmsPipeline(input: {
  userId: string;
  accountId: string;
  raw: RawSmsInput;
  existing: Transaction[];
  sourceSmsId?: string;
  /** When sender is a known bank alias, force this bankId if detector is weak. */
  forcedBankId?: string;
}): PipelineResult {
  const normalized = preprocessSms(input.raw);
  let detection = detectBank(normalized);
  if (
    input.forcedBankId &&
    (!detection.matched || !detection.bankId || detection.conflict)
  ) {
    detection = {
      matched: true,
      confidence: 0.85,
      bankId: input.forcedBankId,
      conflict: false,
    };
  }
  if (detection.conflict) {
    const unknown = toUnknownRecord({
      userId: input.userId,
      sender: normalized.sender,
      bankId: detection.bankId,
      body: normalized.body,
      parserVersion: PARSER_VERSION,
      failureReason: 'PARSER_CONFLICT',
      receivedAt: normalized.receivedAt,
      sourceSmsId: input.sourceSmsId,
    });
    return {
      status: 'unknown',
      unknown,
      telemetry: {
        bankId: detection.bankId,
        parserVersion: PARSER_VERSION,
        success: false,
        patternHash: unknown.patternHash,
        failureReason: 'PARSER_CONFLICT',
      },
    };
  }
  if (!detection.matched || !detection.bankId) {
    const unknown = toUnknownRecord({
      userId: input.userId,
      sender: normalized.sender,
      bankId: detection.bankId,
      body: normalized.body,
      parserVersion: PARSER_VERSION,
      failureReason: 'bank_not_detected',
      receivedAt: normalized.receivedAt,
      sourceSmsId: input.sourceSmsId,
    });
    return {
      status: 'unknown',
      unknown,
      telemetry: {
        bankId: detection.bankId,
        parserVersion: PARSER_VERSION,
        success: false,
        patternHash: unknown.patternHash,
        failureReason: 'bank_not_detected',
      },
    };
  }

  const specific = bankParsers.find(p => p.bankId === detection.bankId);
  let parsed: ParsedTransaction | null = null;
  if (specific && specific.status === 'ok' && specific.canParse(normalized).matched) {
    parsed = specific.parse(normalized);
  } else {
    parsed = parseGenericBankSms(normalized, detection.bankId);
  }

  const telemetry: ParserTelemetry = {
    bankId: detection.bankId,
    parserVersion: PARSER_VERSION,
    success: Boolean(parsed && parsed.amount > 0),
    patternHash: '',
    failureReason: parsed ? undefined : 'unparsed',
  };

  if (!parsed || parsed.amount <= 0) {
    const unknown = toUnknownRecord({
      userId: input.userId,
      sender: normalized.sender,
      bankId: detection.bankId,
      body: normalized.body,
      parserVersion: PARSER_VERSION,
      failureReason: parsed ? 'amount_not_detected' : 'unknown_format',
      receivedAt: normalized.receivedAt,
      sourceSmsId: input.sourceSmsId,
    });
    telemetry.success = false;
    telemetry.patternHash = unknown.patternHash;
    telemetry.failureReason = unknown.failureReason;
    return { status: 'unknown', unknown, telemetry };
  }

  const fingerprint = buildFingerprint({
    userId: input.userId,
    bankId: parsed.bankId,
    type: parsed.type,
    amountRial: parsed.amount,
    date: parsed.transactionDate ?? normalized.receivedAt,
    cardLast4: parsed.cardLast4,
    normalizedText: normalized.body,
    source: 'android_sms',
    sourceSmsId: input.sourceSmsId,
  });

  // PRIMARY identity for inbox SMS: Android _id. Never collapse different IDs.
  if (input.sourceSmsId) {
    if (input.existing.some(tx => tx.sourceSmsId === input.sourceSmsId)) {
      return { status: 'duplicate', telemetry: { ...telemetry, success: true } };
    }
  } else {
    // Live SMS without inbox id yet — fingerprint only (includes full uniqueness fields).
    if (isExactDuplicate(input.existing, fingerprint)) {
      return { status: 'duplicate', telemetry: { ...telemetry, success: true } };
    }
  }

  const draft: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> = {
    userId: input.userId,
    accountId: input.accountId,
    type: parsed.type,
    direction: directionFor(parsed.type, normalized.body),
    amountRial: parsed.amount,
    currency: 'IRR',
    merchant: parsed.merchant,
    description: parsed.description,
    categoryId: categorize({
      merchant: parsed.merchant,
      description: parsed.description,
      type: parsed.type,
    }),
    transactionDate: parsed.transactionDate ?? normalized.receivedAt,
    cardLast4: parsed.cardLast4,
    source: 'android_sms',
    sourceSmsId: input.sourceSmsId,
    parserVersion: PARSER_VERSION,
    fingerprint,
    confidence: parsed.confidence,
    isConfirmed: parsed.confidence >= 0.9,
    needsReview: parsed.confidence < 0.9 && parsed.confidence >= 0.6,
    balanceAfterRial: parsed.balance,
  };

  // Fuzzy amount/window dedupe MUST NOT apply to android_sms with a real sourceSmsId.
  // Two 100M deposits seconds apart are legitimate distinct SMS.
  if (!input.sourceSmsId) {
    const fuzzy = findFuzzyDuplicates(input.existing, draft);
    if (fuzzy.length > 0) {
      return { status: 'duplicate', transaction: draft, telemetry };
    }
  }

  const status = bandFor(parsed.confidence);
  if (status === 'pending') {
    return { status: 'pending', transaction: { ...draft, needsReview: true, isConfirmed: false }, telemetry };
  }
  if (status === 'review') {
    return { status: 'review', transaction: { ...draft, needsReview: true }, telemetry };
  }
  return { status: 'created', transaction: draft, telemetry };
}
