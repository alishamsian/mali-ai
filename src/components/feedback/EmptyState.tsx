import React from 'react';
import { View } from 'react-native';
import { AppText } from '../ui/AppText';
import { PrimaryButton } from '../ui/PrimaryButton';
import { useThemedStyles } from '../../theme/useThemedStyles';

export function EmptyState({
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const styles = useThemedStyles((c, th) => ({
    wrap: { alignItems: 'center', padding: th.spacing.xxl, gap: th.spacing.sm },
    mark: {
      width: 72,
      height: 72,
      borderRadius: 22,
      backgroundColor: 'rgba(59,232,197,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(59,232,197,0.28)',
      marginBottom: th.spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inner: {
      width: 24,
      height: 24,
      borderRadius: 8,
      backgroundColor: c.primary,
      opacity: 0.85,
    },
    title: { textAlign: 'center' },
    subtitle: { textAlign: 'center', color: c.textMuted, lineHeight: 22, maxWidth: 280 },
    action: { marginTop: th.spacing.md, alignSelf: 'stretch', maxWidth: 320 },
  }));

  return (
    <View style={styles.wrap}>
      <View style={styles.mark}>
        <View style={styles.inner} />
      </View>
      <AppText variant="title" style={styles.title}>
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
