import React, { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../components/ui/AppText';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { PressScale } from '../../../components/ui/PressScale';
import { FilterChip } from '../../../components/ui/FilterChip';
import { appAlert } from '../../../components/ui/AppAlert';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { interpolate, t } from '../../../i18n';
import { formatCompactToman, tomanToRial } from '../../../utils/currency/money';
import { AmountInput } from '../../../components/ui/AmountInput';
import { parseIntegerAmount } from '../../../utils/numbers/digits';
import { useFinanceStore } from '../../../store/finance/store';
import { hapticSuccess, hapticWarn } from '../../../utils/haptics';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { StatusChip } from '../../../components/ui/StatusChip';
import { toPersianDigits } from '../../../utils/numbers/digits';
import { Plane, PiggyBank, Target, Wallet } from 'lucide-react-native';
import type { GoalKind, MoneyGoal } from '../../../types/finance';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';

const KINDS: GoalKind[] = ['travel', 'debt', 'savings', 'other'];
const KIND_ICON = { travel: Plane, debt: Wallet, savings: PiggyBank, other: Target } as const;
/** One-tap contributions in toman; anything else goes through the amount field. */
const QUICK_TOMAN = [100_000, 500_000, 1_000_000];

export function GoalsScreen({ embedded = false }: { embedded?: boolean } = {}) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useThemedStyles((c, th) => ({
    head: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
    kicker: { textAlign: 'right', color: c.textMuted, fontSize: 12 },
    link: { color: c.text, fontSize: 13, fontFamily: th.typography.fontFamily.semibold },
    card: { padding: 16, gap: 12 },
    cardHead: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
    kindIcon: {
      width: 44,
      height: 44,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.glassStrong,
    },
    cardMain: { flex: 1, gap: 4 },
    pct: { fontSize: 20, fontFamily: th.typography.fontFamily.bold, color: c.text },
    quick: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
    quickChip: {
      borderRadius: 999,
      paddingHorizontal: 12,
      minHeight: 36,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.glassStrong,
      borderWidth: 1,
      borderColor: c.glassBorder,
    },
    quickText: { color: c.text, fontSize: 13 },
    title: {
      textAlign: 'right',
      color: c.text,
      fontSize: 15,
      fontFamily: th.typography.fontFamily.semibold,
    },
    amount: { textAlign: 'right', color: c.textSecondary, fontSize: 13 },
    track: {
      height: 8,
      borderRadius: 4,
      backgroundColor: c.glassBorder,
      flexDirection: 'row-reverse',
      overflow: 'hidden',
    },
    input: {
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.glassBorder,
      backgroundColor: c.glass,
      color: c.text,
      paddingHorizontal: 12,
      fontFamily: th.typography.fontFamily.regular,
    },
    chips: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
    addRow: { flexDirection: 'row-reverse', alignItems: 'flex-end', gap: 8 },
    addLink: { alignSelf: 'flex-end', paddingVertical: 4 },
    pill: {
      borderRadius: 14,
      paddingHorizontal: 16,
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
    },
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
  const [formOpen, setFormOpen] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);

  const contribute = (id: string, toman: number | null) => {
    if (!toman) {
      hapticWarn();
      return;
    }
    contributeGoal(id, tomanToRial(toman));
    setExtra(s => ({ ...s, [id]: '' }));
    setAdding(null);
    hapticSuccess();
  };

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
    setFormOpen(false);
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
      <View style={styles.head}>
        <AppText style={styles.kicker}>{dict.goals.title}</AppText>
        <Pressable onPress={() => setFormOpen(v => !v)} accessibilityRole="button" hitSlop={8}>
          <AppText style={styles.link}>
            {formOpen ? dict.common.cancel : dict.goals.newGoal}
          </AppText>
        </Pressable>
      </View>
      {formOpen || snapshot.goals.length === 0 ? (
        <GlassPanel strong radius={24} style={styles.card}>
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
              <FilterChip
                key={id}
                label={dict.goals[id]}
                active={kind === id}
                onPress={() => setKind(id)}
              />
            ))}
          </View>
          <AmountInput value={target} onChangeValue={setTarget} placeholder={dict.goals.target} />
          <PrimaryButton label={dict.goals.add} onPress={add} />
        </GlassPanel>
      ) : null}
      {snapshot.goals.map(goal => {
        const share = Math.min(1, goal.savedRial / Math.max(1, goal.targetRial));
        const open = adding === goal.id;
        const Icon = KIND_ICON[goal.kind];
        return (
          <PressScale
            key={goal.id}
            onLongPress={() =>
              appAlert(goal.title, undefined, [
                {
                  text: dict.transactions.delete,
                  style: 'destructive',
                  onPress: () => deleteGoal(goal.id),
                },
                { text: dict.common.cancel, style: 'cancel' },
              ])
            }>
            <GlassPanel radius={24} style={styles.card}>
              <View style={styles.cardHead}>
                <View style={styles.kindIcon}>
                  <Icon size={22} color={share >= 1 ? colors.income : colors.text} />
                </View>
                <View style={styles.cardMain}>
                  <AppText style={styles.title} numberOfLines={1}>
                    {goal.title}
                  </AppText>
                  <AppText style={styles.amount}>
                    {interpolate(dict.goals.savedOf, {
                      saved: formatCompactToman(goal.savedRial),
                      target: formatCompactToman(goal.targetRial),
                    })}
                  </AppText>
                </View>
                <AppText style={[styles.pct, share >= 1 && { color: colors.income }]}>
                  {`${toPersianDigits(Math.round(share * 100))}٪`}
                </AppText>
              </View>
              <ProgressBar
                progress={share}
                color={share >= 1 ? colors.income : colors.highlight}
                track={colors.glassBorder}
              />
              {share >= 1 ? (
                <StatusChip label={dict.goals.reachedShort} color={colors.income} />
              ) : (
                <>
                  <AppText style={styles.kicker}>
                    {interpolate(dict.goals.left, {
                      amount: formatCompactToman(goal.targetRial - goal.savedRial),
                    })}
                  </AppText>
                  {open ? (
                    <View style={styles.addRow}>
                      <AmountInput
                        value={extra[goal.id] ?? ''}
                        onChangeValue={v => setExtra(s => ({ ...s, [goal.id]: v }))}
                        placeholder={dict.goals.addSaved}
                        style={{ flex: 1 }}
                      />
                      <PressScale
                        accessibilityRole="button"
                        onPress={() =>
                          contribute(goal.id, parseIntegerAmount(extra[goal.id] ?? ''))
                        }
                        style={[styles.pill, { backgroundColor: colors.primary }]}>
                        <AppText style={{ color: colors.onPrimary }}>{dict.common.save}</AppText>
                      </PressScale>
                    </View>
                  ) : (
                    <View style={styles.quick}>
                      {QUICK_TOMAN.map(toman => (
                        <PressScale
                          key={toman}
                          accessibilityRole="button"
                          onPress={() => contribute(goal.id, toman)}
                          style={styles.quickChip}>
                          <AppText style={styles.quickText}>{`+ ${formatCompactToman(
                            toman * 10,
                          )}`}</AppText>
                        </PressScale>
                      ))}
                      <PressScale
                        accessibilityRole="button"
                        onPress={() => setAdding(goal.id)}
                        style={styles.quickChip}>
                        <AppText style={styles.quickText}>{dict.goals.otherAmount}</AppText>
                      </PressScale>
                    </View>
                  )}
                </>
              )}
            </GlassPanel>
          </PressScale>
        );
      })}
    </ScrollView>
  );

  if (embedded) {
    return body;
  }
  return <NightCanvas>{body}</NightCanvas>;
}
