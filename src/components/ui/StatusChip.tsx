import React from 'react';
import { View } from 'react-native';
import { AppText } from './AppText';

/** A small tinted pill: a short status next to a title or amount. */
export function StatusChip({ label, color }: { label: string; color: string }) {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        borderRadius: 999,
        paddingHorizontal: 9,
        paddingVertical: 2,
        backgroundColor: /^#[0-9a-fA-F]{6}$/.test(color) ? `${color}22` : 'rgba(127,127,127,0.14)',
      }}>
      <AppText style={{ color, fontSize: 11.5, fontFamily: 'Vazirmatn-Medium' }}>{label}</AppText>
    </View>
  );
}
