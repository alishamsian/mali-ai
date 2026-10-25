import { colors, palette } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';
import { radii } from './radii';
import { shadows } from './shadows';
import { animations } from './animations';
import { tokens } from './tokens';

/** کپی mutable — هرگز مستقیم به colors.dark وصل نشود */
export const theme = {
  mode: 'dark' as 'dark' | 'light',
  colors: { ...colors.dark },
  palette,
  typography,
  spacing,
  radii,
  shadows,
  animations,
  tokens,
};

export type AppTheme = typeof theme;

export { colors, palette, typography, spacing, radii, shadows, animations, tokens };
