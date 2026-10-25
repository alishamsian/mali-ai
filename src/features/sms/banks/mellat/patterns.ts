/** الگوهای تأییدشده از نمونه‌های ملت در fixtures/samples */
export const MELLAT_SENDERS = ['9909', '9980', 'mellat'] as const;

export const MELLAT_BANK_MARK = /بانک\s*ملت/;
export const MELLAT_AMOUNT =
  /(?:واریز\s*مبلغ|مبلغ)\s*([\d,]+)\s*ریال|(?:مبلغ\s*)?([\d,]+)\s*ریال\s*کسر\s*شد/;
export const MELLAT_BALANCE = /مانده\s*([\d,]+)/;
export const MELLAT_CARD = /کارت[^\d\n]*(\d{4})|\*{2,}(\d{4})/;

export const patterns = {
  status: 'ok' as const,
  senders: [...MELLAT_SENDERS],
};
