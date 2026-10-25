import React from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { theme } from '../../../theme';
import type { ThemeSnapshot } from '../../../theme/runtime';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { AppText } from '../../../components/ui/AppText';

function createSettingsUiStyles(colors: ThemeSnapshot['colors'], t: typeof theme) {
  return {
    section: { marginBottom: 18 },
    sectionTitle: {
      textAlign: 'right' as const,
      fontSize: 11,
      color: colors.textMuted,
      marginBottom: 8,
      paddingHorizontal: 4,
      letterSpacing: 0.4,
    },
    card: {
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.035)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.07)',
      overflow: 'hidden' as const,
    },
    row: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      paddingVertical: 14,
      paddingHorizontal: 14,
      gap: 12,
    },
    rowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    rowBody: { flex: 1, alignItems: 'flex-end' as const },
    rowTitle: {
      fontSize: 14,
      textAlign: 'right' as const,
      fontFamily: t.typography.fontFamily.semibold,
    },
    rowSub: {
      marginTop: 3,
      fontSize: 11,
      color: colors.textMuted,
      textAlign: 'right' as const,
    },
    header: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      marginBottom: 16,
    },
    headerTitle: {
      fontSize: 17,
      fontFamily: t.typography.fontFamily.semibold,
    },
    back: { fontSize: 14, minWidth: 48 },
  };
}

export function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useThemedStyles(createSettingsUiStyles);
  return (
    <View style={styles.section}>
      <AppText style={styles.sectionTitle}>{title}</AppText>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

export function SettingsNavRow({
  title,
  subtitle,
  onPress,
  last,
}: {
  title: string;
  subtitle?: string;
  onPress: () => void;
  last?: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(createSettingsUiStyles);
  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, !last && styles.rowBorder]}
      accessibilityRole="button"
      accessibilityLabel={title}>
      <ChevronLeft color={colors.textMuted} size={18} />
      <View style={styles.rowBody}>
        <AppText style={[styles.rowTitle, { color: colors.text }]}>{title}</AppText>
        {subtitle ? <AppText style={styles.rowSub}>{subtitle}</AppText> : null}
      </View>
    </Pressable>
  );
}

export function SettingsToggleRow({
  title,
  subtitle,
  value,
  onValueChange,
  disabled,
  last,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  last?: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(createSettingsUiStyles);
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: colors.primary }}
      />
      <View style={styles.rowBody}>
        <AppText style={[styles.rowTitle, { color: colors.text }]}>{title}</AppText>
        {subtitle ? <AppText style={styles.rowSub}>{subtitle}</AppText> : null}
      </View>
    </View>
  );
}

export function SettingsScreenHeader({
  title,
  backLabel,
  onBack,
}: {
  title: string;
  backLabel: string;
  onBack: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(createSettingsUiStyles);
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel={backLabel}>
        <AppText style={[styles.back, { color: colors.textMuted }]}>{backLabel}</AppText>
      </Pressable>
      <AppText style={[styles.headerTitle, { color: colors.text }]}>{title}</AppText>
      <View style={{ width: 48 }} />
    </View>
  );
}
