import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import {
  ChevronLeft,
  Inbox,
  Landmark,
  MessageSquareText,
  Receipt,
  Settings2,
  Wallet,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppText } from '../../../components/ui/AppText';
import { Badge } from '../../../components/ui/Badge';
import { PressScale } from '../../../components/ui/PressScale';
import { Screen } from '../../../components/ui/Screen';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { Section } from '../../../components/ui/Section';
import { Surface } from '../../../components/ui/Surface';
import { navigateRoot } from '../../../app/navigation/navigateRoot';
import { navigateSmsHub } from '../../../app/navigation/smsNavigation';
import type { RootStackParamList } from '../../../app/navigation/types';
import { t } from '../../../i18n';
import { selectReviewItems, useFinanceStore } from '../../../store/finance/store';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';

type RowItem = {
  id: string;
  label: string;
  subtitle?: string;
  Icon: LucideIcon;
  onPress: () => void;
  badge?: number;
  accent?: string;
};

function NavRow({ item }: { item: RowItem }) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles((c, th) => ({
    row: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: th.spacing.sm,
      paddingVertical: th.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    icon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    meta: { flex: 1, alignItems: 'flex-end', gap: 2 },
    sub: { color: c.textMuted, textAlign: 'right' },
  }));
  const tint = item.accent ?? colors.primary;

  return (
    <PressScale onPress={item.onPress} style={styles.row} accessibilityRole="button">
      <ChevronLeft color={colors.textMuted} size={18} />
      {item.badge ? <Badge label={item.badge} tone="warn" /> : null}
      <View style={styles.meta}>
        <AppText variant="body">{item.label}</AppText>
        {item.subtitle ? (
          <AppText variant="caption" style={styles.sub}>
            {item.subtitle}
          </AppText>
        ) : null}
      </View>
      <View style={[styles.icon, { backgroundColor: `${tint}14`, borderColor: `${tint}33` }]}>
        <item.Icon color={tint} size={20} strokeWidth={2} />
      </View>
    </PressScale>
  );
}

export function ToolsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const dict = t();
  const { colors } = useAppTheme();
  const snapshot = useFinanceStore(s => s.snapshot);
  const reviewCount = useMemo(
    () => selectReviewItems(snapshot).transactions.length + selectReviewItems(snapshot).unknown.length,
    [snapshot],
  );
  const smsOn = snapshot.settings.smsProcessingEnabled;

  const styles = useThemedStyles((_, th) => ({
    body: { paddingHorizontal: th.spacing.lg },
    card: { overflow: 'hidden', paddingHorizontal: th.spacing.md },
    lastRow: { borderBottomWidth: 0 },
  }));

  const planning: RowItem[] = [
    {
      id: 'transactions',
      label: dict.transactions.title,
      Icon: Receipt,
      onPress: () => navigateRoot(navigation, 'Transactions'),
    },
    {
      id: 'budgets',
      label: dict.budgets.hubTitle,
      Icon: Wallet,
      onPress: () => navigateRoot(navigation, 'Budgets'),
    },
  ];

  const smsBank: RowItem[] = [
    {
      id: 'review',
      label: dict.sms.reviewTitle,
      subtitle: dict.dashboard.reviewNow,
      Icon: Inbox,
      badge: reviewCount || undefined,
      onPress: () => navigateRoot(navigation, 'ReviewInbox'),
    },
    {
      id: 'sms',
      label: dict.sms.title,
      subtitle: smsOn ? dict.sms.enabled : dict.sms.disabled,
      Icon: MessageSquareText,
      onPress: () => navigateSmsHub(navigation, smsOn),
    },
    {
      id: 'banks',
      label: dict.onboarding.banksTitle,
      Icon: Landmark,
      accent: colors.filament,
      onPress: () => navigateRoot(navigation, 'SettingsBanksSms'),
    },
  ];

  const account: RowItem[] = [
    {
      id: 'settings',
      label: dict.settings.title,
      Icon: Settings2,
      onPress: () => navigateRoot(navigation, 'Settings'),
    },
  ];

  const renderSection = (title: string, items: RowItem[]) => (
    <Section title={title}>
      <Surface level="raised" style={styles.card}>
        {items.map((item, i) => (
          <View key={item.id} style={i === items.length - 1 ? styles.lastRow : undefined}>
            <NavRow item={item} />
          </View>
        ))}
      </Surface>
    </Section>
  );

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.body}>
          <ScreenHeader title={dict.tools.title} subtitle={dict.tools.subtitle} onBack={() => navigation.goBack()} />
          {renderSection(dict.tools.sectionPlanning, planning)}
          {renderSection(dict.tools.sectionSms, smsBank)}
          {renderSection(dict.tools.sectionAccount, account)}
        </View>
      </ScrollView>
    </Screen>
  );
}
