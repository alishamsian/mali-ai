import React, { useCallback, useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../components/ui/AppText';
import { GlassCard } from '../../../components/ui/GlassCard';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { t } from '../../../i18n';
import { formatTomanLabel } from '../../../utils/currency/money';
import { selectReviewItems, useFinanceStore } from '../../../store/finance/store';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../app/navigation/types';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import type { Transaction, UnknownSmsRecord } from '../../../types/finance';

type Row =
  | { kind: 'header'; id: string; title: string }
  | { kind: 'tx'; id: string; tx: Transaction }
  | { kind: 'unknown'; id: string; item: UnknownSmsRecord };

export function ReviewInboxScreen({
  navigation,
}: {
  navigation: NativeStackNavigationProp<RootStackParamList>;
}) {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles((_c, th) => ({
    screen: { flex: 1, backgroundColor: 'transparent' },
    body: { flex: 1, paddingHorizontal: th.spacing.lg },
    row: { marginTop: 12, gap: 8 },
  }));
  const snapshot = useFinanceStore(s => s.snapshot);
  const confirm = useFinanceStore(s => s.confirmTransaction);
  const remove = useFinanceStore(s => s.deleteTransaction);
  const dismiss = useFinanceStore(s => s.dismissUnknown);
  const dict = t();
  const { transactions, unknown } = selectReviewItems(snapshot);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    if (transactions.length) {
      out.push({ kind: 'header', id: 'h-tx', title: dict.sms.reviewTitle });
      for (const tx of transactions) {
        out.push({ kind: 'tx', id: tx.id, tx });
      }
    }
    if (unknown.length) {
      out.push({ kind: 'header', id: 'h-unknown', title: dict.sms.unknownTitle });
      for (const item of unknown) {
        out.push({ kind: 'unknown', id: item.id, item });
      }
    }
    return out;
  }, [transactions, unknown, dict.sms.reviewTitle, dict.sms.unknownTitle]);

  const renderItem = useCallback(
    ({ item }: { item: Row }) => {
      if (item.kind === 'header') {
        return (
          <AppText variant="label" style={{ textAlign: 'right', marginTop: 8, marginBottom: 4 }}>
            {item.title}
          </AppText>
        );
      }
      if (item.kind === 'tx') {
        const tx = item.tx;
        return (
          <GlassCard>
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
        );
      }
      const u = item.item;
      return (
        <GlassCard>
          <AppText>{u.sender}</AppText>
          <AppText variant="caption">{u.failureReason}</AppText>
          {u.sourceSmsId ? (
            <AppText variant="caption">SMS ID: {u.sourceSmsId}</AppText>
          ) : null}
          {__DEV__ && u.sanitizedMessage ? (
            <AppText variant="caption" style={{ marginTop: 6 }}>
              {u.sanitizedMessage}
            </AppText>
          ) : null}
          <AppText variant="caption">{u.receivedAt}</AppText>
          <Pressable onPress={() => dismiss(u.id)} style={{ paddingTop: 8 }}>
            <AppText variant="caption">{dict.common.cancel}</AppText>
          </Pressable>
        </GlassCard>
      );
    },
    [confirm, dict, dismiss, navigation, remove, styles.row],
  );

  return (
    <NightCanvas>
      <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
        <View style={{ paddingHorizontal: 20 }}>
          <ScreenHeader title={dict.sms.reviewTitle} onBack={() => navigation.goBack()} />
        </View>
        {rows.length === 0 ? (
          <View style={styles.body}>
            <EmptyState title={dict.sms.unknownEmpty} />
          </View>
        ) : (
          <View style={styles.body}>
            <FlashList
              data={rows}
              keyExtractor={row => row.id}
              renderItem={renderItem}
              drawDistance={300}
              contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            />
          </View>
        )}
      </View>
    </NightCanvas>
  );
}
