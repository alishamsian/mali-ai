import React from 'react';
import { View } from 'react-native';
import { AppText } from '../ui/AppText';
import { PrimaryButton } from '../ui/PrimaryButton';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { Inbox, type LucideIcon } from 'lucide-react-native';
import { useAppTheme } from '../../theme/ThemeBridge';

export function EmptyState({
  title,
  subtitle,
  actionLabel,
  onAction,
  Icon = Inbox,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  Icon?: LucideIcon;
}) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles((c, th) => ({
    wrap: { alignItems: 'center', padding: th.spacing.xxl, gap: th.spacing.sm },
    mark: {
      width: 72,
      height: 72,
      borderRadius: 22,
      backgroundColor: th.mode === 'light' ? c.glassStrong : 'rgba(59,232,197,0.08)',
      borderWidth: 1,
      borderColor: th.mode === 'light' ? c.glassBorder : 'rgba(59,232,197,0.28)',
      marginBottom: th.spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      textAlign: 'center',
      fontSize: 18,
      lineHeight: 28,
      fontFamily: th.typography.fontFamily.semibold,
      color: c.text,
      maxWidth: 300,
    },
    subtitle: { textAlign: 'center', color: c.textMuted, lineHeight: 22, maxWidth: 280 },
    action: { marginTop: th.spacing.md, alignSelf: 'stretch', maxWidth: 320 },
  }));

  return (
    <View style={styles.wrap}>
      <View style={styles.mark}>
        <Icon size={28} strokeWidth={1.6} color={colors.text} />
      </View>
      <AppText style={styles.title}>
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="body" style={styles.subtitle}>
          {subtitle}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <PrimaryButton label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}
