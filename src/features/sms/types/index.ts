import type { MoneyCurrency, TransactionSource, TransactionType } from '../../../types/finance';

export interface NormalizedSms {
  sender: string;
  senderName?: string;
  body: string;
  receivedAt: string;
  originalLength: number;
}

export interface DetectionResult {
  matched: boolean;
  confidence: number;
  bankId?: string;
  conflict?: boolean;
  conflictBanks?: Array<{ bankId: string; confidence: number }>;
}

export interface ParsedTransaction {
  bankId: string;
  type: TransactionType;
  amount: number;
  currency: MoneyCurrency;
  balance?: number;
  cardLast4?: string;
  merchant?: string;
  transactionDate?: string;
  description?: string;
  confidence: number;
  source: TransactionSource;
  parserStatus?: 'ok' | 'NEEDS_FIXTURES' | 'NOT_IMPLEMENTED';
}

export interface BankSmsParser {
  bankId: string;
  version: string;
  status: 'ok' | 'NEEDS_FIXTURES' | 'NOT_IMPLEMENTED';
  canParse(message: NormalizedSms): DetectionResult;
  parse(message: NormalizedSms): ParsedTransaction | null;
}

export interface ParserTelemetry {
  bankId?: string;
  parserVersion: string;
  success: boolean;
  failureReason?: string;
  patternHash: string;
}
