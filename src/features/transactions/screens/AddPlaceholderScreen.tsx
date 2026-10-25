import React from 'react';
import { View } from 'react-native';
import { AppText } from '../../../components/ui/AppText';
import { t } from '../../../i18n';
import { useThemedStyles } from '../../../theme/useThemedStyles';

/** Placeholder tab; the center button opens AddTransaction. */
export function AddPlaceholderScreen() {
  const dict = t();
  const styles = useThemedStyles(colors => ({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
  }));
  return (
    <View style={styles.screen}>
      <AppText>{dict.add.title}</AppText>
    </View>
  );
}
