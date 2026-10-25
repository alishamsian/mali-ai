import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../components/ui/AppText';
import { GlassCard } from '../../../components/ui/GlassCard';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { interpolate, t } from '../../../i18n';
import { formatTomanLabel, tomanToRial } from '../../../utils/currency/money';
import { AmountInput } from '../../../components/ui/AmountInput';
import { parseIntegerAmount } from '../../../utils/numbers/digits';
import { toJalaliLabel } from '../../../utils/dates/jalali';
import { detectRecurring } from '../../../engine/recurring/detect';
import { useFinanceStore } from '../../../store/finance/store';
import { hapticSuccess, hapticWarn } from '../../../utils/haptics';
import type { RecurringTransaction } from '../../../types/finance';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';

export function RecurringScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useThemedStyles((c, t) => ({
    input: {
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      color: c.text,
      paddingHorizontal: 12,
      marginTop: 10,
      fontFamily: t.typography.fontFamily.regular,
    },
    pinAll: {
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
    },
  }));
  const snapshot = useFinanceStore(s => s.snapshot);
  const upsert = useFinanceStore(s => s.upsertRecurring);
  const remove = useFinanceStore(s => s.deleteRecurring);
  const dict = t();
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const detected = useMemo(
    () => detectRecurring(snapshot.transactions, snapshot.profile.id),
    [snapshot.transactions, snapshot.profile.id],
  );
  const pinnedIds = useMemo(
    () => new Set(snapshot.recurring.map(item => item.id)),
    [snapshot.recurring],
  );
  const suggestions = useMemo(
    () => detected.filter(item => !pinnedIds.has(item.id)),
    [detected, pinnedIds],
  );

  const saveManual = () => {
    const toman = parseIntegerAmount(amount);
    if (!merchant.trim() || !toman) {
      hapticWarn();
      return;
    }
    const item: RecurringTransaction = {
      id: `rec_manual_${Date.now()}`,
      userId: snapshot.profile.id,
      merchant: merchant.trim(),
      amountRial: tomanToRial(toman),
      frequency: 'monthly',
      categoryId: 'bills',
      nextExpectedDate: new Date(Date.now() + 30 * 86400000).toISOString(),
    };
    upsert(item);
    hapticSuccess();
    setMerchant('');
    setAmount('');
  };

  const pinOne = (item: RecurringTransaction) => {
    upsert(item);
    hapticSuccess();
  };

  const pinAll = () => {
    if (suggestions.length === 0) {
      return;
    }
    for (const item of suggestions) {
      upsert(item);
    }
    hapticSuccess();
  };

  const body = (
    <ScrollView
      contentContainerStyle={{
        paddingTop: embedded ? 0 : insets.top + 12,
        padding: embedded ? 0 : 20,
        gap: 12,
        paddingBottom: embedded ? 8 : 48,
      }}
      nestedScrollEnabled={embedded}
      showsVerticalScrollIndicator={false}>
      {!embedded ? (
        <AppText variant="title" style={{ textAlign: 'center' }}>
          {dict.bills.title}
        </AppText>
      ) : null}
        <GlassCard>
          <TextInput
            value={merchant}
            onChangeText={setMerchant}
            placeholder={dict.transactions.merchant}
            placeholderTextColor={colors.textMuted}
            textAlign="right"
            style={styles.input}
          />
          <AmountInput
            value={amount}
            onChangeValue={setAmount}
            placeholder={dict.goals.target}
            style={{ marginTop: 10 }}
            inputStyle={{ marginTop: 0, backgroundColor: 'transparent', borderColor: colors.border }}
          />
          <PrimaryButton label={dict.bills.add} onPress={saveManual} />
        </GlassCard>
        {snapshot.recurring.map(item => (
          <GlassCard key={item.id}>
            <AppText>{item.merchant}</AppText>
            <AppText variant="caption">
              {formatTomanLabel(item.amountRial)} · {dict.bills[item.frequency]} · {toJalaliLabel(item.nextExpectedDate)}
            </AppText>
            <Pressable onPress={() => remove(item.id)} style={{ marginTop: 8 }}>
              <AppText variant="caption">{dict.transactions.delete}</AppText>
            </Pressable>
          </GlassCard>
        ))}
        <AppText variant="kicker">{dict.insights.recurring}</AppText>
        {suggestions.length > 1 ? (
          <Pressable onPress={pinAll} style={styles.pinAll}>
            <AppText style={{ color: colors.primary, textAlign: 'center' }}>
              {dict.bills.pinAll}
            </AppText>
          </Pressable>
        ) : null}
        {suggestions.length === 0 && snapshot.recurring.length === 0 ? (
          <EmptyState title={dict.bills.empty} />
        ) : (
          suggestions.map(item => (
            <GlassCard key={item.id}>
              <AppText>{item.merchant}</AppText>
              <AppText variant="caption">
                {formatTomanLabel(item.amountRial)} ·{' '}
                {interpolate(dict.insights.dueIn, {
                  n: Math.max(
                    0,
                    Math.round((Date.parse(item.nextExpectedDate) - Date.now()) / 86400000),
                  ),
                })}{' '}
                · {toJalaliLabel(item.nextExpectedDate)}
              </AppText>
              <Pressable onPress={() => pinOne(item)} style={{ marginTop: 8 }}>
                <AppText style={{ color: colors.primary }}>{dict.bills.pinSuggestion}</AppText>
              </Pressable>
            </GlassCard>
          ))
        )}
      </ScrollView>
  );

  if (embedded) {
    return body;
  }
  return <NightCanvas>{body}</NightCanvas>;
}
