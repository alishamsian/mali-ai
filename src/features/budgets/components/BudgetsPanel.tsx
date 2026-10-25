import React, { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '../../../components/ui/AppText';
import { GlassCard } from '../../../components/ui/GlassCard';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { interpolate, t } from '../../../i18n';
import { formatTomanFromRial, tomanToRial } from '../../../utils/currency/money';
import { AmountInput } from '../../../components/ui/AmountInput';
import { parseIntegerAmount, sanitizeAmountDigits } from '../../../utils/numbers/digits';
import { useFinanceStore } from '../../../store/finance/store';
import { categoryTotals, isExpenseLike } from '../../../engine/insights/analytics';
import { budgetAlerts } from '../../../engine/budget/alerts';
import { BUDGET_SETUP_CATEGORIES } from '../../../constants/categories';
import { hapticSuccess } from '../../../utils/haptics';
import type { Budget, BudgetCategory, CategoryId } from '../../../types/finance';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';

export function BudgetsPanel() {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(c => ({
    barBg: {
      height: 8,
      borderRadius: 8,
      backgroundColor: 'rgba(255,255,255,0.08)',
      overflow: 'hidden' as const,
      marginTop: 8,
    },
    bar: { height: 8, backgroundColor: c.primary },
    row: { flexDirection: 'row-reverse' as const, justifyContent: 'space-between' as const },
    limitRow: {
      flexDirection: 'row-reverse' as const,
      alignItems: 'center' as const,
      gap: 10,
      marginTop: 10,
    },
  }));
  const snapshot = useFinanceStore(s => s.snapshot);
  const upsertBudget = useFinanceStore(s => s.upsertBudget);
  const dict = t();
  const spent = categoryTotals(snapshot.transactions.filter(isExpenseLike));
  const budget = snapshot.budgets[0];
  const cats = snapshot.budgetCategories.filter(c => !budget || c.budgetId === budget.id);
  const rows = cats.map(c => {
    const used = spent[c.categoryId] ?? 0;
    return {
      id: c.categoryId as CategoryId,
      used,
      limit: c.limitRial,
      pct: Math.min(1, used / Math.max(1, c.limitRial)),
    };
  });
  const overall =
    rows.length === 0
      ? 0
      : rows.reduce((s, r) => s + r.used, 0) / Math.max(1, rows.reduce((s, r) => s + r.limit, 0));
  const alerts = budgetAlerts(snapshot);
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const next: Record<string, string> = {};
    for (const c of cats) {
      next[c.categoryId] = String(Math.round(c.limitRial / 10));
    }
    return next;
  });

  const save = () => {
    const now = new Date();
    const id = budget?.id ?? `bud_${now.getFullYear()}_${now.getMonth() + 1}`;
    const next: Budget = {
      id,
      userId: snapshot.profile.id,
      period: 'monthly',
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      totalLimitRial: 0,
      createdAt: budget?.createdAt ?? now.toISOString(),
    };
    const categories: BudgetCategory[] = BUDGET_SETUP_CATEGORIES.map(categoryId => {
      const toman = parseIntegerAmount(draft[categoryId] ?? '') ?? 0;
      return {
        id: `${id}_${categoryId}`,
        budgetId: id,
        categoryId,
        limitRial: tomanToRial(toman),
      };
    }).filter(c => c.limitRial > 0);
    next.totalLimitRial = categories.reduce((s, c) => s + c.limitRial, 0);
    upsertBudget(next, categories);
    hapticSuccess();
  };

  return (
    <>
      {alerts.map(alert => (
        <AppText
          key={alert.categoryId}
          variant="caption"
          style={{ color: colors.expense, textAlign: 'right', marginTop: 8 }}>
          {interpolate(alert.ratio >= 1 ? dict.budgets.over : dict.budgets.warn, {
            name: dict.categories[alert.categoryId],
            pct: Math.round(alert.ratio * 100),
          })}
        </AppText>
      ))}
      <GlassCard style={{ marginTop: 16 }}>
        <AppText variant="kicker">{dict.budgets.setLimits}</AppText>
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
        <View style={{ height: 12 }} />
        <PrimaryButton label={dict.budgets.saveMonth} onPress={save} />
      </GlassCard>
      {rows.length === 0 ? (
        <EmptyState title={dict.budgets.empty} />
      ) : (
        <>
          <AppText variant="hero" style={{ textAlign: 'center', marginVertical: 16 }}>
            {Math.round(overall * 100)}٪
          </AppText>
          <AppText variant="caption" style={{ textAlign: 'center', marginBottom: 16 }}>
            {dict.budgets.used}
          </AppText>
          <View style={styles.barBg}>
            <View style={[styles.bar, { width: `${Math.round(Math.min(100, overall * 100))}%` }]} />
          </View>
          {rows.map(r => (
            <GlassCard key={r.id} style={{ marginTop: 12 }}>
              <View style={styles.row}>
                <AppText variant="caption">{Math.round(r.pct * 100)}٪</AppText>
                <AppText>{dict.categories[r.id]}</AppText>
              </View>
              <AppText variant="caption">
                {formatTomanFromRial(r.used)} / {formatTomanFromRial(r.limit)}
              </AppText>
              <View style={styles.barBg}>
                <View
                  style={[
                    styles.bar,
                    {
                      width: `${Math.round(r.pct * 100)}%`,
                      backgroundColor: r.pct >= 0.8 ? colors.expense : colors.primary,
                    },
                  ]}
                />
              </View>
            </GlassCard>
          ))}
        </>
      )}
    </>
  );
}
