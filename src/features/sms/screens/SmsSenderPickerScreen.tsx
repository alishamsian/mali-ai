import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { AppText } from '../../../components/ui/AppText';
import { Badge } from '../../../components/ui/Badge';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { Surface } from '../../../components/ui/Surface';
import { PressScale } from '../../../components/ui/PressScale';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { t } from '../../../i18n';
import type { RootStackParamList } from '../../../app/navigation/types';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { requestSmsPermission } from '../native/SmsModule';
import { loadSmsPickerCandidates, type PickerSmsItem } from '../senders/pickerCandidates';
import { toJalaliLabel, toTimeLabel } from '../../../utils/dates/jalali';
import { resolveBankName } from '../../banks/names';

export function SmsSenderPickerScreen({
  navigation,
  route,
}: {
  navigation: NativeStackNavigationProp<RootStackParamList, 'SmsSenderPicker'>;
  route: RouteProp<RootStackParamList, 'SmsSenderPicker'>;
}) {
  const { bankId } = route.params;
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const dict = t();
  const bankName = resolveBankName(bankId);
  const [items, setItems] = useState<PickerSmsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = useThemedStyles((c, th) => ({
    screen: { flex: 1, backgroundColor: 'transparent' },
    body: { flex: 1, paddingHorizontal: th.spacing.lg },
    card: { marginBottom: th.spacing.sm, gap: 6 },
    cardTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
    footer: {
      paddingHorizontal: th.spacing.lg,
      paddingTop: th.spacing.sm,
      paddingBottom: insets.bottom + 12,
      gap: th.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: c.glassStrong,
    },
    toggle: { textAlign: 'center' as const, color: c.primary },
  }));

  const load = useCallback(async (all: boolean) => {
    setLoading(true);
    setError(null);
    const ok = await requestSmsPermission();
    if (!ok) {
      setError(dict.sms.historyPermission);
      setLoading(false);
      return;
    }
    try {
      const rows = await loadSmsPickerCandidates({ showAll: all });
      setItems(rows);
    } catch {
      setError(dict.sms.scanFail);
    } finally {
      setLoading(false);
    }
  }, [dict.sms.historyPermission, dict.sms.scanFail]);

  useEffect(() => {
    void load(showAll);
  }, [load, showAll]);

  const renderItem = useCallback(
    ({ item }: { item: PickerSmsItem }) => (
      <PressScale
        onPress={() =>
          navigation.navigate('SmsSenderConfirm', {
            bankId,
            sender: item.senderDisplay,
            previewBody: item.preview,
            body: item.body,
            receivedAt: item.receivedAt,
            sourceSmsId: item.sourceSmsId,
          })
        }>
        <Surface level="raised" padded style={styles.card}>
          <View style={styles.cardTop}>
            <AppText variant="label">{item.senderDisplay}</AppText>
            <AppText variant="caption">{toTimeLabel(item.receivedAt)}</AppText>
          </View>
          <AppText variant="body" style={{ textAlign: 'right' }} numberOfLines={2}>
            {item.preview}
          </AppText>
          <AppText variant="caption" style={{ textAlign: 'right' }}>
            {toJalaliLabel(item.receivedAt)}
          </AppText>
          {item.transactionLike ? <Badge label={dict.sms.transactionLikeBadge} tone="brand" /> : null}
        </Surface>
      </PressScale>
    ),
    [bankId, dict.sms.transactionLikeBadge, navigation, styles.card, styles.cardTop],
  );

  return (
    <NightCanvas>
      <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
        <View style={{ paddingHorizontal: 20 }}>
          <ScreenHeader
            title={dict.sms.findSenderTitle.replace('{{bank}}', bankName)}
            subtitle={dict.sms.findSenderBody.replace('{{bank}}', bankName)}
            onBack={() => navigation.goBack()}
          />
          <AppText variant="caption" style={{ textAlign: 'right', marginBottom: 12, color: colors.textMuted }}>
            {dict.sms.verifiedSenderPrivacy}
          </AppText>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 48 }} color={colors.primary} />
        ) : error ? (
          <EmptyState title={error} />
        ) : (
          <View style={styles.body}>
            <FlashList
              data={items}
              keyExtractor={(item, i) => item.sourceSmsId ?? `${item.sender}-${i}`}
              renderItem={renderItem}
              drawDistance={280}
              ListEmptyComponent={<EmptyState title={dict.sms.pickerEmpty} />}
              contentContainerStyle={{ paddingBottom: 12 }}
            />
          </View>
        )}

        <View style={styles.footer}>
          <PressScale onPress={() => setShowAll(v => !v)}>
            <AppText variant="caption" style={styles.toggle}>
              {showAll ? dict.sms.showCandidatesOnly : dict.sms.showAllRecent}
            </AppText>
          </PressScale>
          <PrimaryButton label={dict.common.cancel} onPress={() => navigation.goBack()} />
        </View>
      </View>
    </NightCanvas>
  );
}
