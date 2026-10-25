import React from 'react';
import { StyleSheet, View } from 'react-native';
import { theme } from '../../theme';
import { AppText } from './AppText';

export function SectionKicker({ children }: { children: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.line} />
      <AppText variant="kicker">{children}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    marginTop: 26,
    marginBottom: 12,
  },
  line: {
    width: 18,
    height: 1,
    backgroundColor: theme.palette.filament,
    opacity: 0.7,
  },
});
