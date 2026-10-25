import React from 'react';
import { View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useAppTheme } from '../../theme/ThemeBridge';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { AppText } from './AppText';
import { PressScale } from './PressScale';

export function AlertBanner({
  message,
  tone = 'info',
  onPress,
}: {
  message: string;
  tone?: 'info' | 'warn' | 'success';
  onPress?: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles((_colors, theme) => ({
    banner: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 16,
      borderWidth: 1,
      backgroundColor: theme.palette.surfaceSolid,
      marginBottom: 10,
    },
    dot: { width: 8, height: 8, borderRadius: 4 },
    msg: { flex: 1, textAlign: 'right', fontSize: 14 },
  }));
  const accent =
    tone === 'warn' ? colors.warning : tone === 'success' ? colors.income : colors.primary;
  return (
    <PressScale onPress={onPress} disabled={!onPress} style={[styles.banner, { borderColor: `${accent}44` }]}>
      <View style={[styles.dot, { backgroundColor: accent }]} />
      <AppText variant="body" style={styles.msg} numberOfLines={2}>
        {message}
      </AppText>
      {onPress ? <ChevronLeft color={colors.textMuted} size={18} /> : null}
    </PressScale>
  );
}
