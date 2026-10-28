import { parseVoiceTransaction } from './voiceParser';

describe('parseVoiceTransaction', () => {
  it.each([
    ['پنجاه هزار تومان قهوه کافه نیکو', 50_000, 'out', 'قهوه کافه نیکو'],
    ['۲ میلیون و ۵۰۰ هزار تومان قسط وام', 2_500_000, 'out', 'وام'],
    ['سیصد و پنجاه هزار تومن خرید از هایپر استار', 350_000, 'out', 'هایپر استار'],
    ['120,000 تومان تاکسی', 120_000, 'out', 'تاکسی'],
    ['واریز حقوق 25 میلیون', 25_000_000, 'in', ''],
    ['۸۰۰۰۰۰ ریال نان', 80_000, 'out', 'نان'],
    ['یه میلیون دادم به علی', 1_000_000, 'out', 'علی'],
  ])('%s', (text, amount, direction, merchant) => {
    const draft = parseVoiceTransaction(text);
    expect(draft.amountToman).toBe(amount);
    expect(draft.direction).toBe(direction);
    expect(draft.merchant).toBe(merchant);
  });

  it('keeps the words when no amount was heard', () => {
    expect(parseVoiceTransaction('ناهار با دوستان')).toMatchObject({ amountToman: 0, merchant: 'ناهار دوستان' });
  });
});
