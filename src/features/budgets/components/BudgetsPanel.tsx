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

  const { rows, used, limit, projected, previousUsed } = useMemo(() => {
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
  }));

  const toneOf = (pace: Pace) =>
    pace === 'over' ? colors.expense : pace === 'tight' ? colors.highlight : colors.income;
  const bar = (pct: number, color: string) => (
    <View style={styles.track}>
      <View style={{ flex: Math.min(1, pct), backgroundColor: color, borderRadius: 4 }} />
      <View style={{ flex: Math.max(0, 1 - pct) }} />
    </View>
  );

  if (editing) {
    return (
      <GlassPanel strong radius={26} style={styles.panel}>
        <AppText style={styles.kicker}>{dict.budgets.setLimits}</AppText>
        {BUDGET_SETUP_CATEGORIES.map(id => (
          <View key={id} style={styles.limitRow}>
            <AmountInput
              value={draft[id] ?? ''}
              onChangeValue={v => setDraft(s => ({ ...s, [id]: sanitizeAmountDigits(v) }))}
              placeholder="0"
              showWords={Boolean(draft[id])}
              style={{ width: 132 }}
              inputStyle={{ minHeight: 44, width: 132, paddingHorizontal: 10 }}
            />
            <AppText style={{ flex: 1, textAlign: 'right' }}>{dict.categories[id]}</AppText>
          </View>
        ))}
        <PrimaryButton label={dict.budgets.saveMonth} onPress={save} />
        <Pressable
          onPress={() => setEditing(false)}
          style={styles.cancel}
          accessibilityRole="button">
          <AppText style={styles.amount}>{dict.common.cancel}</AppText>
        </Pressable>
      </GlassPanel>
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
  return (
    <>
      <GlassPanel strong radius={26} style={styles.panel}>
        <View style={styles.head}>
          <AppText style={styles.kicker}>{dict.budgets.thisMonth}</AppText>
          <Pressable onPress={openEditor} accessibilityRole="button" hitSlop={8}>
            <AppText style={styles.link}>{dict.budgets.edit}</AppText>
          </Pressable>
        </View>
        <AppText style={styles.big}>
          {interpolate(dict.budgets.usedOf, {
            used: formatCompactToman(used),
            limit: formatCompactToman(limit),
          })}
        </AppText>
        {bar(used / Math.max(1, limit), toneOf(overallPace))}
        <AppText style={[styles.sub, overallPace !== 'ok' && { color: toneOf(overallPace) }]}>
          {overallPace === 'over'
            ? dict.budgets.paceOver
            : interpolate(overallPace === 'tight' ? dict.budgets.paceTight : dict.budgets.paceOk, {
                amount: formatCompactToman(projected),
              })}
        </AppText>
        {previousUsed > 0 ? (
          <AppText style={styles.amount}>
            {interpolate(dict.budgets.lastMonth, {
              used: formatCompactToman(previousUsed),
              limit: formatCompactToman(limit),
            })}
          </AppText>
        ) : null}
      </GlassPanel>

      <GlassPanel radius={26} style={styles.panel}>
        {rows.map(r => (
          <View key={r.id} style={styles.row}>
            <View style={styles.rowHead}>
              <AppText style={styles.name}>{dict.categories[r.id]}</AppText>
              <AppText style={[styles.amount, r.pace !== 'ok' && { color: toneOf(r.pace) }]}>
                {interpolate(dict.budgets.usedOf, {
                  used: formatCompactToman(r.used),
                  limit: formatCompactToman(r.limit),
                })}
              </AppText>
            </View>
            {bar(r.pct, toneOf(r.pace))}
          </View>
        ))}
      </GlassPanel>
    </>
  );
}
