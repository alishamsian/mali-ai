import React, { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../components/ui/AppText';
import { GlassCard } from '../../../components/ui/GlassCard';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { interpolate, t } from '../../../i18n';
import { formatTomanFromRial, tomanToRial } from '../../../utils/currency/money';
import { AmountInput } from '../../../components/ui/AmountInput';
import { parseIntegerAmount } from '../../../utils/numbers/digits';
import { useFinanceStore } from '../../../store/finance/store';
import { hapticSuccess, hapticWarn } from '../../../utils/haptics';
import type { GoalKind, MoneyGoal } from '../../../types/finance';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';

const KINDS: GoalKind[] = ['travel', 'debt', 'savings', 'other'];

export function GoalsScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useThemedStyles((c, th) => ({
    input: {
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      color: c.text,
      paddingHorizontal: 12,
      marginTop: 10,
      fontFamily: th.typography.fontFamily.regular,
    },
    chips: { flexDirection: 'row-reverse' as const, flexWrap: 'wrap' as const, gap: 8, marginTop: 10 },
    chip: { borderWidth: 1, borderColor: c.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
    chipOn: { borderColor: c.primary, backgroundColor: th.palette.primaryGlow },
    barBg: { height: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' as const, marginTop: 8 },
    bar: { height: 8, backgroundColor: c.primary },
    row: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginTop: 12 },
  }));
  const snapshot = useFinanceStore(s => s.snapshot);
  const upsertGoal = useFinanceStore(s => s.upsertGoal);
  const deleteGoal = useFinanceStore(s => s.deleteGoal);
  const contributeGoal = useFinanceStore(s => s.contributeGoal);
  const dict = t();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<GoalKind>('savings');
  const [target, setTarget] = useState('');
  const [extra, setExtra] = useState<Record<string, string>>({});

  const add = () => {
    const toman = parseIntegerAmount(target);
    if (!title.trim() || !toman) {
      hapticWarn();
      return;
    }
    const now = new Date().toISOString();
    const goal: MoneyGoal = {
      id: `goal_${Date.now()}`,
      userId: snapshot.profile.id,
      title: title.trim(),
      kind,
      targetRial: tomanToRial(toman),
      savedRial: 0,
      createdAt: now,
      updatedAt: now,
    };
    upsertGoal(goal);
    hapticSuccess();
    setTitle('');
    setTarget('');
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
          {dict.goals.title}
        </AppText>
      ) : null}
        <GlassCard>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={dict.goals.titleField}
            placeholderTextColor={colors.textMuted}
            textAlign="right"
            style={styles.input}
          />
          <View style={styles.chips}>
            {KINDS.map(id => (
              <Pressable key={id} onPress={() => setKind(id)} style={[styles.chip, kind === id && styles.chipOn]}>
                <AppText variant="caption">{dict.goals[id]}</AppText>
              </Pressable>
            ))}
          </View>
          <AmountInput
            value={target}
            onChangeValue={setTarget}
            placeholder={dict.goals.target}
            style={{ marginTop: 10 }}
            inputStyle={{ marginTop: 0, backgroundColor: 'transparent', borderColor: colors.border }}
          />
          <PrimaryButton label={dict.goals.add} onPress={add} />
        </GlassCard>
        {snapshot.goals.length === 0 ? (
          <EmptyState title={dict.goals.empty} />
        ) : (
          snapshot.goals.map(goal => {
            const pct = Math.min(100, Math.round((goal.savedRial / Math.max(1, goal.targetRial)) * 100));
            return (
              <GlassCard key={goal.id}>
                <AppText>{goal.title}</AppText>
                <AppText variant="caption">{dict.goals[goal.kind]}</AppText>
                <AppText variant="caption" style={{ marginTop: 8 }}>
                  {interpolate(dict.goals.progress, { pct })} · {formatTomanFromRial(goal.savedRial)} /{' '}
                  {formatTomanFromRial(goal.targetRial)}
                </AppText>
                <View style={styles.barBg}>
                  <View style={[styles.bar, { width: `${pct}%` }]} />
                </View>
                <AmountInput
                  value={extra[goal.id] ?? ''}
                  onChangeValue={v => setExtra(s => ({ ...s, [goal.id]: v }))}
                  placeholder={dict.goals.addSaved}
                  style={{ marginTop: 10 }}
                  inputStyle={{ marginTop: 0, backgroundColor: 'transparent', borderColor: colors.border }}
                />
                <View style={styles.row}>
                  <Pressable onPress={() => deleteGoal(goal.id)}>
                    <AppText variant="caption">{dict.transactions.delete}</AppText>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      const toman = parseIntegerAmount(extra[goal.id] ?? '');
                      if (!toman) {
                        hapticWarn();
                        return;
                      }
                      contributeGoal(goal.id, tomanToRial(toman));
                      setExtra(s => ({ ...s, [goal.id]: '' }));
                      hapticSuccess();
                    }}>
                    <AppText>{dict.common.save}</AppText>
                  </Pressable>
                </View>
              </GlassCard>
            );
          })
        )}
      </ScrollView>
  );

  if (embedded) {
    return body;
  }
  return <NightCanvas>{body}</NightCanvas>;
}
