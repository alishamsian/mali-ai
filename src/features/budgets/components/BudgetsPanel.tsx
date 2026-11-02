import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '../../../components/ui/AppText';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { AmountInput } from '../../../components/ui/AmountInput';
import { interpolate, t } from '../../../i18n';
import { formatCompactToman, tomanToRial } from '../../../utils/currency/money';
import { parseIntegerAmount, sanitizeAmountDigits } from '../../../utils/numbers/digits';
import { useFinanceStore } from '../../../store/finance/store';
import { categoryTotals } from '../../../engine/insights/analytics';
import { currentMonthWindow } from '../../../engine/insights/monthPeriod';
import { BUDGET_SETUP_CATEGORIES } from '../../../constants/categories';
import { hapticSuccess } from '../../../utils/haptics';
import { ProgressRing } from '../../../components/ui/ProgressRing';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { StatusChip } from '../../../components/ui/StatusChip';
import { categoryIcons } from '../../../components/lists/TransactionRow';
import { toPersianDigits } from '../../../utils/numbers/digits';
import type { Budget, BudgetCategory, CategoryId } from '../../../types/finance';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';

type Pace = 'ok' | 'tight' | 'over';

/** This month against the limits first; the limits form opens only when asked for. */
export function BudgetsPanel() {
  const { colors } = useAppTheme();
  const dict = t();
  const snapshot = useFinanceStore(s => s.snapshot);
  const upsertBudget = useFinanceStore(s => s.upsertBudget);
  const budget = snapshot.budgets[0];
  const cats = snapshot.budgetCategories.filter(c => !budget || c.budgetId === budget.id);
  const [editing, setEditing] = useState(false);

  const { rows, used, limit, projected, previousUsed, daysLeft, prevSpent } = useMemo(() => {
    // This month only: the old panel summed every expense ever recorded.
    const window = currentMonthWindow(snapshot.settings);
    const start = window.start.getTime();
    const spent = categoryTotals(
      snapshot.transactions.filter(tx => Date.parse(tx.transactionDate) >= start),
    );
    const meta = window;
    const pace = (usedRial: number, limitRial: number): Pace => {
      if (usedRial >= limitRial) {
        return 'over';
      }
      const projectedRial = (usedRial / Math.max(1, meta.day)) * meta.daysInMonth;
      return projectedRial > limitRial ? 'tight' : 'ok';
    };
    const list = cats
      .map(c => {
        const usedRial = spent[c.categoryId] ?? 0;
        return {
          id: c.categoryId as CategoryId,
          used: usedRial,
          limit: c.limitRial,
          pct: usedRial / Math.max(1, c.limitRial),
          pace: pace(usedRial, c.limitRial),
        };
      })
      .sort((a, b) => b.pct - a.pct);
    // Last month against the same limits: a simple history without storing one budget per month.
    const prevSpent = categoryTotals(
      snapshot.transactions.filter(tx => {
        const at = Date.parse(tx.transactionDate);
        return at >= window.previousStart.getTime() && at < start;
      }),
    );
    const prevUsed = cats.reduce((sum, c) => sum + (prevSpent[c.categoryId] ?? 0), 0);
    const totalUsed = list.reduce((s, r) => s + r.used, 0);
    const totalLimit = list.reduce((s, r) => s + r.limit, 0);
    return {
      rows: list,
      used: totalUsed,
      limit: totalLimit,
      projected: Math.round((totalUsed / Math.max(1, meta.day)) * meta.daysInMonth),
      previousUsed: prevUsed,
      daysLeft: Math.max(1, meta.daysInMonth - meta.day + 1),
      prevSpent,
    };
  }, [cats, snapshot.transactions, snapshot.settings]);

  const [draft, setDraft] = useState<Record<string, string>>({});
  const openEditor = () => {
    const next: Record<string, string> = {};
    for (const c of cats) {
      next[c.categoryId] = String(Math.round(c.limitRial / 10));
    }
    setDraft(next);
    setEditing(true);
  };

  const save = () => {
    const now = new Date();
    const id = budget?.id ?? `bud_${now.getFullYear()}_${now.getMonth() + 1}`;
    const categories: BudgetCategory[] = BUDGET_SETUP_CATEGORIES.map(categoryId => ({
      id: `${id}_${categoryId}`,
      budgetId: id,
      categoryId,
      limitRial: tomanToRial(parseIntegerAmount(draft[categoryId] ?? '') ?? 0),
    })).filter(c => c.limitRial > 0);
    const next: Budget = {
      id,
      userId: snapshot.profile.id,
      period: 'monthly',
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      totalLimitRial: categories.reduce((s, c) => s + c.limitRial, 0),
      createdAt: budget?.createdAt ?? now.toISOString(),
    };
    upsertBudget(next, categories);
    hapticSuccess();
    setEditing(false);
  };

  const styles = useThemedStyles((c, th) => ({
    panel: { padding: 18, gap: 12, marginTop: 12 },
    head: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
    kicker: { textAlign: 'right', color: c.textMuted, fontSize: 12 },
    link: { color: c.text, fontSize: 13, fontFamily: th.typography.fontFamily.semibold },
    big: {
      textAlign: 'right',
      color: c.text,
      fontSize: 26,
      fontFamily: th.typography.fontFamily.bold,
    },
    sub: { textAlign: 'right', color: c.textSecondary, fontSize: 13 },
    track: {
      height: 8,
      borderRadius: 4,
      backgroundColor: c.glassBorder,
      flexDirection: 'row-reverse',
      overflow: 'hidden',
    },
    row: { gap: 6 },
    rowHead: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
    name: { color: c.text, fontSize: 14 },
    amount: { color: c.textMuted, fontSize: 12 },
    limitRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
    cancel: { padding: 12, alignItems: 'center' },
    editHead: { padding: 18, gap: 4 },
    suggestAll: { alignSelf: 'flex-end', paddingVertical: 6 },
    editRow: { padding: 6, paddingBottom: 12, gap: 4 },
    hintChip: {
      paddingHorizontal: 10,
      minHeight: 32,
      borderRadius: 999,
      justifyContent: 'center',
      backgroundColor: c.glassStrong,
      borderWidth: 1,
      borderColor: c.glassBorder,
    },
    hintText: { color: c.text, fontSize: 12 },
    hero: { padding: 18, gap: 16, marginTop: 12 },
    heroRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 18 },
    heroText: { flex: 1, gap: 4 },
    ringPct: {
      fontSize: 22,
      lineHeight: 30,
      color: c.text,
      fontFamily: th.typography.fontFamily.bold,
    },
    ringCaption: { fontSize: 11, color: c.textMuted },
    left: {
      textAlign: 'right',
      fontSize: 26,
      lineHeight: 38,
      color: c.text,
      fontFamily: th.typography.fontFamily.bold,
    },
    stats: { flexDirection: 'row-reverse', gap: 10 },
    stat: { flex: 1, padding: 12, borderRadius: 16, gap: 2, backgroundColor: c.glass },
    statValue: {
      textAlign: 'right',
      color: c.text,
      fontSize: 14,
      fontFamily: th.typography.fontFamily.semibold,
    },
    list: { padding: 6, marginTop: 12 },
    cat: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, padding: 12 },
    catIcon: {
      width: 40,
      height: 40,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.glassStrong,
    },
    catBody: { flex: 1, gap: 6 },
    catHead: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    catName: { color: c.text, fontSize: 14, fontFamily: th.typography.fontFamily.semibold },
    editBtn: {
      marginTop: 12,
      minHeight: 46,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.glassBorder,
    },
  }));

  const toneOf = (pace: Pace) =>
    pace === 'over' ? colors.expense : pace === 'tight' ? colors.highlight : colors.income;

  if (editing) {
    // Last month's spend, rounded up to a tidy figure, as a starting point for each limit.
    const suggest = (id: CategoryId) => {
      const toman = Math.round((prevSpent[id] ?? 0) / 10);
      return toman > 0 ? String(Math.ceil(toman / 100_000) * 100_000) : '';
    };
    const draftTotal = BUDGET_SETUP_CATEGORIES.reduce(
      (sum, id) => sum + (parseIntegerAmount(draft[id] ?? '') ?? 0),
      0,
    );
    const hasSuggestions = BUDGET_SETUP_CATEGORIES.some(id => suggest(id));
    return (
      <View style={{ gap: 10, marginTop: 12 }}>
        <GlassPanel strong radius={24} style={styles.editHead}>
          <AppText style={styles.kicker}>{dict.budgets.monthTotal}</AppText>
          <AppText style={styles.left}>{formatCompactToman(draftTotal * 10)}</AppText>
          {hasSuggestions ? (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                setDraft(d => {
                  const next = { ...d };
                  for (const id of BUDGET_SETUP_CATEGORIES) {
                    next[id] = next[id] || suggest(id);
                  }
                  return next;
                })
              }
              style={styles.suggestAll}>
              <AppText style={styles.link}>{dict.budgets.fillFromLastMonth}</AppText>
            </Pressable>
          ) : null}
        </GlassPanel>
        {BUDGET_SETUP_CATEGORIES.map(id => {
          const Icon = categoryIcons[id];
          const hint = suggest(id);
          return (
            <GlassPanel key={id} radius={20} style={styles.editRow}>
              <View style={styles.cat}>
                <View style={styles.catIcon}>
                  {Icon ? <Icon size={20} color={colors.text} /> : null}
                </View>
                <View style={styles.catBody}>
                  <AppText style={styles.catName}>{dict.categories[id]}</AppText>
                  {prevSpent[id] ? (
                    <AppText style={styles.amount}>
                      {interpolate(dict.budgets.lastMonthSpent, {
                        amount: formatCompactToman(prevSpent[id] ?? 0),
                      })}
                    </AppText>
                  ) : null}
                </View>
                {hint && draft[id] !== hint ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setDraft(s => ({ ...s, [id]: hint }))}
                    style={styles.hintChip}>
                    <AppText style={styles.hintText}>
                      {formatCompactToman(Number(hint) * 10)}
                    </AppText>
                  </Pressable>
                ) : null}
              </View>
              <AmountInput
                value={draft[id] ?? ''}
                onChangeValue={v => setDraft(s => ({ ...s, [id]: sanitizeAmountDigits(v) }))}
                placeholder={dict.budgets.noLimit}
                showWords={Boolean(draft[id])}
              />
            </GlassPanel>
          );
        })}
        <PrimaryButton label={dict.budgets.saveMonth} onPress={save} />
        <Pressable
          onPress={() => setEditing(false)}
          style={styles.cancel}
          accessibilityRole="button">
          <AppText style={styles.amount}>{dict.common.cancel}</AppText>
        </Pressable>
      </View>
    );
  }

  if (rows.length === 0) {
    return (
      <GlassPanel radius={26} style={styles.panel}>
        <EmptyState
          title={dict.budgets.empty}
          subtitle={dict.budgets.emptyHint}
          actionLabel={dict.budgets.setUp}
          onAction={openEditor}
        />
      </GlassPanel>
    );
  }

  const overallPace: Pace = used >= limit ? 'over' : projected > limit ? 'tight' : 'ok';
  const tone = toneOf(overallPace);
  const share = used / Math.max(1, limit);
  const remaining = limit - used;
  return (
    <>
      <GlassPanel strong radius={26} style={styles.hero}>
        <View style={styles.head}>
          <AppText style={styles.kicker}>{dict.budgets.thisMonth}</AppText>
          <Pressable onPress={openEditor} accessibilityRole="button" hitSlop={8}>
            <AppText style={styles.link}>{dict.budgets.edit}</AppText>
          </Pressable>
        </View>
        <View style={styles.heroRow}>
          <ProgressRing
            progress={share}
            size={112}
            stroke={11}
            color={tone}
            track={colors.glassBorder}>
            <AppText style={styles.ringPct}>{`${toPersianDigits(
              Math.round(share * 100),
            )}٪`}</AppText>
            <AppText style={styles.ringCaption}>{dict.budgets.usedShort}</AppText>
          </ProgressRing>
          <View style={styles.heroText}>
            <AppText style={styles.kicker}>
              {remaining >= 0 ? dict.budgets.remaining : dict.budgets.overBy}
            </AppText>
            <AppText style={[styles.left, remaining < 0 && { color: colors.expense }]}>
              {formatCompactToman(Math.abs(remaining))}
            </AppText>
            <StatusChip
              label={
                overallPace === 'over'
                  ? dict.budgets.chipOver
                  : overallPace === 'tight'
                  ? dict.budgets.chipTight
                  : dict.budgets.chipOk
              }
              color={tone}
            />
          </View>
        </View>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <AppText style={styles.kicker}>{dict.budgets.perDay}</AppText>
            <AppText style={styles.statValue}>
              {remaining > 0 ? formatCompactToman(remaining / daysLeft) : '—'}
            </AppText>
          </View>
          <View style={styles.stat}>
            <AppText style={styles.kicker}>{dict.budgets.forecast}</AppText>
            <AppText style={[styles.statValue, overallPace !== 'ok' && { color: tone }]}>
              {formatCompactToman(projected)}
            </AppText>
          </View>
          {previousUsed > 0 ? (
            <View style={styles.stat}>
              <AppText style={styles.kicker}>{dict.budgets.prevMonth}</AppText>
              <AppText style={styles.statValue}>{formatCompactToman(previousUsed)}</AppText>
            </View>
          ) : null}
        </View>
      </GlassPanel>

      <GlassPanel radius={26} style={styles.list}>
        {rows.map(r => {
          const Icon = categoryIcons[r.id];
          const rowTone = toneOf(r.pace);
          return (
            <View key={r.id} style={styles.cat}>
              <View style={styles.catIcon}>{Icon ? <Icon size={20} color={rowTone} /> : null}</View>
              <View style={styles.catBody}>
                <View style={styles.catHead}>
                  <AppText style={styles.catName}>{dict.categories[r.id]}</AppText>
                  <AppText style={[styles.amount, r.pace !== 'ok' && { color: rowTone }]}>
                    {`${toPersianDigits(Math.round(r.pct * 100))}٪`}
                  </AppText>
                </View>
                <ProgressBar
                  progress={r.pct}
                  color={rowTone}
                  track={colors.glassBorder}
                  height={7}
                />
                <AppText style={styles.amount}>
                  {interpolate(dict.budgets.usedOf, {
                    used: formatCompactToman(r.used),
                    limit: formatCompactToman(r.limit),
                  })}
                </AppText>
              </View>
            </View>
          );
        })}
      </GlassPanel>
    </>
  );
}
