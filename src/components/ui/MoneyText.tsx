import React, { useSyncExternalStore } from 'react';
import { Text, type TextProps } from 'react-native';
import { theme } from '../../theme';
import { getThemeRevision, getThemeSnapshot, subscribeTheme } from '../../theme/runtime';

type Align = 'left' | 'right' | 'center';

export function MoneyText({
  style,
  minFontScale = 0.58,
  align = 'left',
  color,
  ...rest
}: TextProps & {
  minFontScale?: number;
  align?: Align;
  color?: string;
}) {
  useSyncExternalStore(subscribeTheme, getThemeRevision, getThemeRevision);
  const { colors } = getThemeSnapshot();

  return (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={minFontScale}
      ellipsizeMode="clip"
      style={[
        {
          color: color ?? colors.text,
          fontFamily: theme.typography.fontFamily.semibold,
          writingDirection: 'ltr',
          textAlign: align,
          flexShrink: 1,
        },
        style,
      ]}
      {...rest}
    />
  );
}
