import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useAppTheme } from '../../theme/ThemeBridge';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { AppText } from './AppText';

type BadgeTone = 'brand' | 'gold' | 'warn' | 'muted';

export function Badge({
  label,
  tone = 'brand',
  style,
}: {
  label: string | number;
  tone?: BadgeTone;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles((_c, th) => ({
    wrap: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: th.radii.pill,
      borderWidth: 1,
      minWidth: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: { fontSize: 10, fontFamily: th.typography.fontFamily.semibold },
  }));

  const toneStyle: Record<BadgeTone, { bg: string; border: string; color: string }> = {
    brand: { bg: 'rgba(59,232,197,0.12)', border: 'rgba(59,232,197,0.35)', color: colors.primary },
    gold: { bg: 'rgba(212,180,131,0.12)', border: 'rgba(212,180,131,0.35)', color: colors.filament },
    warn: { bg: 'rgba(232,195,106,0.14)', border: 'rgba(232,195,106,0.4)', color: colors.warning },
    muted: { bg: 'rgba(255,255,255,0.06)', border: colors.border, color: colors.textMuted },
  };
  const t = toneStyle[tone];

  return (
    <View style={[styles.wrap, { backgroundColor: t.bg, borderColor: t.border }, style]}>
      <AppText style={[styles.text, { color: t.color }]}>{String(label)}</AppText>
    </View>
  );
}
