import { compactSize, compactText } from './typeScale';

test('large type shrinks most, small type stays readable, line height follows', () => {
  expect(compactSize(11)).toBe(11);
  expect(compactSize(13)).toBe(12.5);
  expect(compactSize(16)).toBe(15);
  expect(compactSize(36)).toBe(31.5);
  expect(compactText({ fontSize: 24, lineHeight: 36 })).toEqual({ fontSize: 21.5, lineHeight: 32 });
  expect(compactText({ color: 'red' })).toEqual({ color: 'red' });
});
