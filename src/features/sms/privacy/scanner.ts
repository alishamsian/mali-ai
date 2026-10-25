/**
 * Privacy scanner — blocks fixture export when sensitive data remains.
 */

export type PrivacyHit =
  | 'full_card'
  | 'iban'
  | 'otp'
  | 'phone'
  | 'suspicious';

export type PrivacyScanResult = {
  ok: boolean;
  hits: PrivacyHit[];
};

export function scanForSensitiveData(text: string): PrivacyScanResult {
  const hits: PrivacyHit[] = [];

  if (/\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/.test(text)) {
    hits.push('full_card');
  }
  if (/(?:IR|ir)\d{24}/.test(text.replace(/[\s-]/g, '')) || /شبا[:\s]*\d{10,}/.test(text)) {
    hits.push('iban');
  }
  if (/رمز\s*(?:پویا|یکبار)?[:\s]*\d{4,8}/.test(text) || /\bOTP[:\s]*\d{4,8}/i.test(text)) {
    hits.push('otp');
  }
  if (/09\d{9}/.test(text.replace(/[\s-]/g, ''))) {
    hits.push('phone');
  }
  // Suspicious: long unbroken digit runs that look like PII
  if (/\d{15,}/.test(text.replace(/[,\s]/g, ''))) {
    hits.push('suspicious');
  }

  return { ok: hits.length === 0, hits };
}
