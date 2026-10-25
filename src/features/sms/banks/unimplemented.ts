import type { BankSmsParser, DetectionResult, NormalizedSms, ParsedTransaction } from '../types';

export function createUnimplementedParser(bankId: string): BankSmsParser {
  return {
    bankId,
    version: '0.0.0-fixtures-required',
    status: 'NEEDS_FIXTURES',
    canParse(_message: NormalizedSms): DetectionResult {
      return { matched: false, confidence: 0, bankId };
    },
    parse(_message: NormalizedSms): ParsedTransaction | null {
      return null;
    },
  };
}
