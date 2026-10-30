import { normalizeSmsSender, sendersEqual, sendersMatch } from './normalize';

describe('normalizeSmsSender', () => {
  it('treats country-code and local forms of a number as one sender', () => {
    expect(normalizeSmsSender('+98 9830009417')).toBe('9830009417');
    expect(normalizeSmsSender('009830009417')).toBe('9830009417');
    expect(normalizeSmsSender('9830009417')).toBe('9830009417');
    expect(sendersEqual('+98 912 123 4567', '09121234567')).toBe(true);
  });

  it('keeps alphanumeric senders and short codes as they are', () => {
    expect(normalizeSmsSender('Bank Mellat')).toBe('bankmellat');
    expect(normalizeSmsSender('9909')).toBe('9909');
  });

  it('still matches a sender saved with its country prefix by an older version', () => {
    expect(sendersMatch('9830009417', '989830009417')).toBe(true);
    expect(sendersMatch('983000', '9830009417')).toBe(false);
  });
});
