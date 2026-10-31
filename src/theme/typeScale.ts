import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';

/** Sizes at or below this stay as written: small text is already at its readable floor. */
const FLOOR = 11;
/** How much of every point above the floor is kept. Vazirmatn sets large for its size. */
const KEEP = 0.82;

/** A designed font size as it is drawn: big type shrinks most, captions hardly at all. */
export function compactSize(size: number): number {
  return size <= FLOOR ? size : Math.round((FLOOR + (size - FLOOR) * KEEP) * 2) / 2;
}

/**
 * The app's one type-scale step, applied where text is drawn (AppText, MoneyText) so
 * every screen keeps its relative hierarchy. Line height follows the font size.
 */
export function compactText(style: StyleProp<TextStyle>): TextStyle {
  const flat = StyleSheet.flatten(style) ?? {};
  const { fontSize, lineHeight } = flat;
  if (typeof fontSize !== 'number') {
    return flat;
  }
  const size = compactSize(fontSize);
  return {
    ...flat,
    fontSize: size,
    lineHeight:
      typeof lineHeight === 'number' ? Math.round((lineHeight * size) / fontSize) : lineHeight,
  };
}
