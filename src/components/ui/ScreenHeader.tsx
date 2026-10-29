import React from 'react';
import { View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useAppTheme } from '../../theme/ThemeBridge';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { AppText } from './AppText';
import { PressScale } from './PressScale';

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
  backLabel = 'بازگشت',
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  backLabel?: string;
}) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles((c, th) => ({
    wrap: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      marginBottom: th.spacing.lg,
      minHeight: 44,
    },
    back: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: th.palette.surfaceSolid,
      borderWidth: 1,
      borderColor: c.border,
    },
    backSpacer: { width: 44 },
    center: { flex: 1, alignItems: 'center', gap: 2 },
    title: { fontSize: 20 },
    subtitle: { textAlign: 'center' },
    right: { width: 44, alignItems: 'center', justifyContent: 'center' },
  }));

  return (
    <View style={styles.wrap}>
      {onBack ? (
        <PressScale onPress={onBack} style={styles.back} accessibilityLabel={backLabel}>
          <ChevronRight color={colors.textSecondary} size={22} />
        </PressScale>
      ) : (
        <View style={styles.backSpacer} />
      )}
      <View style={styles.center}>
        <AppText variant="title" style={styles.title}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" style={styles.subtitle}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <View style={styles.right}>{right ?? <View style={styles.backSpacer} />}</View>
    </View>
  );
}
