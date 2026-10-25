import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { AppText } from './AppText';
import { PressScale } from './PressScale';

export function Section({
  title,
  subtitle,
  actionLabel,
  onAction,
  children,
  style,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useThemedStyles((c, th) => ({
    wrap: { marginTop: th.spacing.xl, gap: th.spacing.sm },
    head: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: th.spacing.sm,
      marginBottom: th.spacing.xs,
    },
    titles: { flex: 1, alignItems: 'flex-end', gap: 2 },
    subtitle: { color: c.textMuted, textAlign: 'right' },
    action: { color: c.primary, fontFamily: th.typography.fontFamily.medium },
  }));

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.head}>
        <View style={styles.titles}>
          <AppText variant="label">{title}</AppText>
          {subtitle ? (
            <AppText variant="caption" style={styles.subtitle}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {actionLabel && onAction ? (
          <PressScale onPress={onAction} hitSlop={8}>
            <AppText variant="caption" style={styles.action}>
              {actionLabel}
            </AppText>
          </PressScale>
        ) : null}
      </View>
      {children}
    </View>
  );
}
