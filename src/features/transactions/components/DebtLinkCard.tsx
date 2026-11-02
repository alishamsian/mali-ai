import React, { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { HandCoins } from 'lucide-react-native';
import { AppText } from '../../../components/ui/AppText';
import { BottomSheet } from '../../../components/ui/BottomSheet';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { PressScale } from '../../../components/ui/PressScale';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { useFinanceStore } from '../../../store/finance/store';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { debtRemainingRial } from '../../../engine/obligations/schedule';
import { formatCompactToman } from '../../../utils/currency/money';
import { interpolate, t } from '../../../i18n';
import type { Transaction } from '../../../types/finance';

/**
 * «This was a loan»: books a card transaction as money lent or borrowed, or as a repayment
 * of an open debt. The card balance keeps the movement; net worth keeps the money (as a
 * receivable or a liability); spending and income leave it out.
 */
export function DebtLinkCard({ tx }: { tx: Transaction }) {
  const { colors } = useAppTheme();
  const dict = t().transactions;
  const debts = useFinanceStore(s => s.snapshot.debts);
  const link = useFinanceStore(s => s.linkTransactionToDebt);
  const unlink = useFinanceStore(s => s.unlinkTransactionDebt);
  const [open, setOpen] = useState(false);
  const [person, setPerson] = useState('');
  const out = tx.direction === 'out';
  // Paying out settles what I borrowed; money coming in settles what I lent.
  const settleable = useMemo(
    () =>
      debts.filter(d => debtRemainingRial(d) > 0 && d.direction === (out ? 'borrowed' : 'lent')),
    [debts, out],
  );
  const linked = tx.debtId ? debts.find(d => d.id === tx.debtId) : undefined;
  const styles = useThemedStyles((c, th) => ({
    card: { padding: 14, flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
    icon: {
      width: 40,
      height: 40,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.glassStrong,
    },
    main: { flex: 1, gap: 2 },
    title: { textAlign: 'right', color: c.text, fontFamily: th.typography.fontFamily.semibold },
    sub: { textAlign: 'right', color: c.textMuted, fontSize: 12 },
    action: { color: c.text, fontSize: 13, fontFamily: th.typography.fontFamily.semibold },
    section: { textAlign: 'right', color: c.textSecondary, fontSize: 12.5, marginTop: 6 },
    input: {
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.glassBorder,
      backgroundColor: c.glass,
      color: c.text,
      paddingHorizontal: 14,
      fontFamily: th.typography.fontFamily.regular,
    },
    row: {
      flexDirection: 'row-reverse',
      justifyContent: 'space-between',
      alignItems: 'center',
      minHeight: 48,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: c.glassStrong,
    },
    body: { gap: 10, paddingBottom: 8 },
  }));
  if (tx.transferId || (tx.direction !== 'in' && tx.direction !== 'out')) {
    return null;
  }
  if (tx.debtId) {
    return (
      <GlassPanel radius={20} style={styles.card}>
        <View style={styles.icon}>
          <HandCoins size={20} color={colors.income} />
        </View>
        <View style={styles.main}>
          <AppText style={styles.title}>
            {interpolate(dict.debtLinked, { person: linked?.person ?? '—' })}
          </AppText>
          <AppText style={styles.sub}>{dict.debtLinkedHint}</AppText>
        </View>
        <PressScale accessibilityRole="button" onPress={() => unlink(tx.id)} hitSlop={8}>
          <AppText style={styles.action}>{dict.debtUnlink}</AppText>
        </PressScale>
      </GlassPanel>
    );
  }
  const save = (target: { person: string } | { debtId: string }) => {
    link(tx.id, target);
    setOpen(false);
    setPerson('');
  };
  return (
    <>
      <PressScale accessibilityRole="button" onPress={() => setOpen(true)}>
        <GlassPanel radius={20} style={styles.card}>
          <View style={styles.icon}>
            <HandCoins size={20} color={colors.textSecondary} />
          </View>
          <View style={styles.main}>
            <AppText style={styles.title}>{out ? dict.debtWasLent : dict.debtWasBorrowed}</AppText>
            <AppText style={styles.sub}>{dict.debtWhy}</AppText>
          </View>
        </GlassPanel>
      </PressScale>
      <BottomSheet
        visible={open}
        title={out ? dict.debtWasLent : dict.debtWasBorrowed}
        onClose={() => setOpen(false)}>
        <View style={styles.body}>
          <AppText style={styles.section}>{out ? dict.debtNewLent : dict.debtNewBorrowed}</AppText>
          <TextInput
            value={person}
            onChangeText={setPerson}
            placeholder={dict.debtPerson}
            placeholderTextColor={colors.textMuted}
            textAlign="right"
            style={styles.input}
          />
          <PrimaryButton
            label={out ? dict.debtSaveLent : dict.debtSaveBorrowed}
            onPress={() => person.trim() && save({ person })}
          />
          {settleable.length ? (
            <>
              <AppText style={styles.section}>
                {out ? dict.debtRepayMine : dict.debtRepayTheirs}
              </AppText>
              {settleable.map(d => (
                <PressScale
                  key={d.id}
                  accessibilityRole="button"
                  onPress={() => save({ debtId: d.id })}
                  style={styles.row}>
                  <AppText style={styles.title}>{d.person}</AppText>
                  <AppText style={styles.sub}>
                    {interpolate(dict.debtRemaining, {
                      amount: formatCompactToman(debtRemainingRial(d)),
                    })}
                  </AppText>
                </PressScale>
              ))}
            </>
          ) : null}
        </View>
      </BottomSheet>
    </>
  );
}
