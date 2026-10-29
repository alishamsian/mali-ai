import { formatCompactToman } from './money';

describe('formatCompactToman', () => {
  it.each([
    [133_000_000, '۱۳٫۳ میلیون'],
    [8_500_000, '۸۵۰ هزار'],
    [25_000_000_000, '۲٫۵ میلیارد'],
    [-1_500_000_000, '−۱۵۰ میلیون'],
    [5_000, '۵۰۰'],
  ])('%d rial → %s', (rial, label) => {
    expect(formatCompactToman(rial)).toBe(label);
  });
});
