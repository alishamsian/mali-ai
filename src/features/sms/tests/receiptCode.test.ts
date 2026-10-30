import { extractReceiptCode } from '../pipeline/run';

describe('extractReceiptCode', () => {
  it.each([
    ['انتقال 500000\nشماره پیگیری: ۱۲۳۴۵۶۷۸', '12345678'],
    ['خرید 90000 مرجع 998877665544', '998877665544'],
    ['برداشت 120000\nمانده 900000', undefined],
  ])('%s', (body, code) => {
    expect(extractReceiptCode(body)).toBe(code);
  });
});
