import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../components/ui/AppText';
import { GlassCard } from '../../../components/ui/GlassCard';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { interpolate, t } from '../../../i18n';
import { formatTomanLabel } from '../../../utils/currency/money';
import { toJalaliLabel } from '../../../utils/dates/jalali';
import { selectReviewItems, useFinanceStore } from '../../../store/finance/store';
import { budgetAlerts } from '../../../engine/budget/alerts';
import { withSettingsDefaults } from '../lib/settingsDefaults';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../app/navigation/types';
import { useAppTheme } from '../../../theme/ThemeBridge';

export function NotificationsScreen({
  navigation,
}: {
  navigation: NativeStackNavigationProp<RootStackParamList>;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const snapshot = useFinanceStore(s => s.snapshot);
  const confirm = useFinanceStore(s => s.confirmTransaction);
  const remove = useFinanceStore(s => s.deleteTransaction);
  const dismiss = useFinanceStore(s => s.dismissUnknown);
  const dict = t();
  const settings = withSettingsDefaults(snapshot.settings);
  const prefs = settings.notificationPrefs!;
  const master = settings.notificationsEnabled;

  const { transactions, unknown } = selectReviewItems(snapshot);
  const showBudgets = master && prefs.budgets && settings.budgetAlertsEnabled;
  const showTx = master && prefs.transactions;
  const showGoals = master && prefs.goals;
  const showSystem = master && prefs.system;

  const alerts = showBudgets ? budgetAlerts(snapshot) : [];
  const due = showGoals
    ? snapshot.recurring.filter(item => {
        const days = (Date.parse(item.nextExpectedDate) - Date.now()) / 86400000;
        return days <= 7;
      })
    : [];
  const reviewTx = showTx ? transactions : [];
  const reviewUnknown = showSystem || showTx ? unknown : [];

  const empty =
    !master ||
    (alerts.length === 0 &&
      reviewTx.length === 0 &&
      reviewUnknown.length === 0 &&
      due.length === 0);

  return (
    <NightCanvas>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          padding: 20,
          gap: 12,
          paddingBottom: 48,
        }}>
        <AppText variant="title" style={{ textAlign: 'center' }}>
          {dict.profile.notifications}
        </AppText>
        {!master ? (
          <EmptyState title={dict.settings.notifMasterOff} />
        ) : empty ? (
          <EmptyState title={dict.profile.alertsEmpty} />
        ) : null}
        <Pressable onPress={() => navigation.navigate('SettingsNotifications')}>
          <AppText variant="caption" style={{ textAlign: 'center', color: colors.primary }}>
            {dict.settings.notificationPrefsLink}
          </AppText>
        </Pressable>
        {alerts.map(alert => (
          <Pressable key={alert.categoryId} onPress={() => navigation.navigate('Budgets')}>
            <GlassCard>
              <AppText>
                {interpolate(alert.ratio >= 1 ? dict.budgets.over : dict.budgets.warn, {
                  name: dict.categories[alert.categoryId],
                  pct: Math.round(alert.ratio * 100),
                })}
              </AppText>
            </GlassCard>
          </Pressable>
        ))}
        {due.map(item => (
          <Pressable key={item.id} onPress={() => navigation.navigate('Recurring')}>
            <GlassCard>
              <AppText variant="kicker">{dict.profile.dueSoon}</AppText>
              <AppText>
                {item.merchant} · {toJalaliLabel(item.nextExpectedDate)}
              </AppText>
            </GlassCard>
          </Pressable>
        ))}
        {showTx ? <AppText variant="label">{dict.sms.reviewTitle}</AppText> : null}
        {reviewTx.map(tx => (
          <GlassCard key={tx.id}>
            <AppText>{tx.merchant ?? tx.type}</AppText>
            <AppText variant="caption">{formatTomanLabel(tx.amountRial)}</AppText>
            <View style={styles.row}>
              <PrimaryButton label={dict.sms.confirm} onPress={() => confirm(tx.id)} />
              <Pressable onPress={() => navigation.navigate('TransactionDetails', { id: tx.id })}>
                <AppText variant="caption">{dict.sms.correct}</AppText>
              </Pressable>
              <Pressable onPress={() => remove(tx.id)}>
                <AppText variant="caption">{dict.transactions.delete}</AppText>
              </Pressable>
            </View>
          </GlassCard>
        ))}
        {reviewUnknown.map(item => (
          <GlassCard key={item.id}>
            <AppText>{item.sender}</AppText>
            <AppText variant="caption">{item.failureReason}</AppText>
            <Pressable onPress={() => dismiss(item.id)} style={{ paddingTop: 8 }}>
              <AppText variant="caption">{dict.common.cancel}</AppText>
            </Pressable>
          </GlassCard>
        ))}
      </ScrollView>
    </NightCanvas>
  );
}

const styles = StyleSheet.create({
  row: { marginTop: 12, gap: 8 },
});
