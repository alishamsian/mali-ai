/**
 * Local SMS sanitizer — masks PII while keeping parser-useful structure.
 * Never invents data; only redacts.
 */

export type SanitizeResult = {
  sanitized: string;
  redactions: Array<'card' | 'iban' | 'phone' | 'otp' | 'url' | 'account'>;
};

export function sanitizeSmsText(raw: string): SanitizeResult {
  let text = raw;
  const hits: SanitizeResult['redactions'] = [];

  if (/https?:\/\/\S+/i.test(text)) {
    text = text.replace(/https?:\/\/\S+/gi, '[URL]');
    hits.push('url');
  }

  if (/(?:IR|ir)[\s-]?\d{2}[\d\s-]{10,}/.test(text) || /شبا[:\s]*[\d\s-]{10,}/.test(text)) {
    text = text.replace(/(?:IR|ir)[\s-]?\d{2}([\d\s-]{10,})/gi, 'IR****');
    text = text.replace(/(شبا[:\s]*)([\d\s-]{10,})/g, '$1****');
    hits.push('iban');
  }

  if (/\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/.test(text)) {
    text = text.replace(/\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?(\d{4})/g, '****$1');
    hits.push('card');
  }

  if (/0?9\d{9}/.test(text.replace(/\s/g, ''))) {
    text = text.replace(/0?9\d{2}[\s-]?\d{3}[\s-]?\d{4}/g, '09*********');
    hits.push('phone');
  }

  if (/رمز\s*(?:پویا|یکبار|یک‌بار)?[:\s]*\d{4,8}/.test(text) || /\bOTP[:\s]*\d{4,8}/i.test(text)) {
    text = text.replace(/(رمز\s*(?:پویا|یکبار|یک‌بار)?[:\s]*)\d{4,8}/g, '$1******');
    text = text.replace(/(\bOTP[:\s]*)\d{4,8}/gi, '$1******');
    hits.push('otp');
  }

  if (/(?:حساب|حساب[:\s]*)\d{8,14}/.test(text)) {
    text = text.replace(/(حساب[:\s]*)(\d{4,})(\d{4})/g, '$1****$3');
    hits.push('account');
  }

  return { sanitized: text, redactions: [...new Set(hits)] };
}
