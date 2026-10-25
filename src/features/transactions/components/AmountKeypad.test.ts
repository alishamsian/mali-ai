import { applyKey } from './AmountKeypad';

describe('applyKey', () => {
  it('appends digits and the 000 shortcut', () => {
    expect(applyKey('25', '000')).toBe('25000');
    expect(applyKey('', '7')).toBe('7');
  });
  it('never starts with zeros', () => {
    expect(applyKey('', '0')).toBe('');
    expect(applyKey('', '000')).toBe('');
  });
  it('deletes, clears and caps length', () => {
    expect(applyKey('250', 'del')).toBe('25');
    expect(applyKey('250', 'clear')).toBe('');
    expect(applyKey('999999999999', '1')).toBe('999999999999');
  });
});
