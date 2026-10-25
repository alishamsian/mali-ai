import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NightCanvas } from './NightCanvas';
import { tokens } from '../../theme/tokens';

export function Screen({
  children,
  withTabBarInset = false,
  style,
}: {
  children: React.ReactNode;
  withTabBarInset?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const bottomPad = withTabBarInset
    ? Math.max(insets.bottom, 10) + tokens.layout.tabBarClearance
    : insets.bottom + tokens.spacing.lg;

  return (
    <NightCanvas>
      <View
        style={[
          {
            flex: 1,
            paddingTop: insets.top + tokens.spacing.sm,
            paddingBottom: bottomPad,
          },
          style,
        ]}>
        {children}
      </View>
    </NightCanvas>
  );
}
