import React, { useState } from 'react';
import { TextInput, View } from 'react-native';
import { TrendingDown } from 'lucide-react-native';
import { AppText } from '../../../components/ui/AppText';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { FilterChip } from '../../../components/ui/FilterChip';
import { t, interpolate } from '../../../i18n';
import { useFinanceStore } from '../../../store/finance/store';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { formatTomanFromRial, displayUnitLabel } from '../../../utils/currency/money';
import { toEnglishDigits, toPersianDigits } from '../../../utils/numbers/digits';
import { liquidBalanceRial } from '../../../engine/obligations/dues';
import { purchasingPowerAfter } from '../../../engine/insights/inflation';

/** The user picks the assumed rate; the app does not claim an official figure. */
const RATES = [25, 35, 45];
const DEFAULT_RATE = 35;

/** Vault: what today's cash will buy in a year at the assumed inflation rate. */
export function InflationCard({ hidden }: { hidden: boolean }) {
  const { colors } = useAppTheme();
  const dict = t().inflation;
  const accounts = useFinanceStore(s => s.snapshot.accounts);
  const pct = useFinanceStore(s => s.snapshot.settings.annualInflationPct) ?? DEFAULT_RATE;
  const [editing, setEditing] = useState(false);
  const [custom, setCustom] = useState('');
  const saveCustom = () => {
    const value = Number(custom);
    if (value >= 1 && value <= 200) {
      useFinanceStore.getState().updateSettings({ annualInflationPct: value });
    }
    setEditing(false);
  };
  const styles = useThemedStyles((c, th) => ({
    panel: { padding: 16, gap: 10 },
    head: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
    title: { textAlign: 'right', fontFamily: th.typography.fontFamily.semibold, color: c.text },
    body: { textAlign: 'right', color: c.textMuted, fontSize: 12 },
    value: {
      textAlign: 'right',
      fontSize: 22,
      fontFamily: th.typography.fontFamily.bold,
      color: c.text,
    },
    loss: { textAlign: 'right', color: c.warning, fontSize: 12 },
    chips: { flexDirection: 'row-reverse', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    customInput: {
      minWidth: 64,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.glassBorder,
      color: c.text,
      paddingHorizontal: 10,
    },
  }));

  const liquid = liquidBalanceRial(accounts);
  if (liquid <= 0) {
    return null;
  }
  const after = purchasingPowerAfter(liquid, 12, pct);
  const money = (rial: number) =>
    hidden ? '••••' : `${formatTomanFromRial(rial)} ${displayUnitLabel()}`;
  return (
    <GlassPanel radius={28} style={styles.panel}>
      <View style={styles.head}>
        <TrendingDown size={18} color={colors.warning} />
        <AppText style={styles.title}>{dict.title}</AppText>
      </View>
      <AppText style={styles.body}>{interpolate(dict.body, { pct: toPersianDigits(pct) })}</AppText>
      <AppText style={styles.value}>{money(after)}</AppText>
      {hidden ? null : (
        <AppText style={styles.loss}>
          {interpolate(dict.loss, { amount: formatTomanFromRial(liquid - after) })}
        </AppText>
      )}
      <View style={styles.chips}>
        <AppText style={styles.body}>{dict.change}</AppText>
        {RATES.map(rate => (
          <FilterChip
            key={rate}
            label={`${toPersianDigits(rate)}٪`}
            active={rate === pct}
            onPress={() => useFinanceStore.getState().updateSettings({ annualInflationPct: rate })}
          />
        ))}
        {/* Any other rate the user believes in, 1–200%. */}
        {editing ? (
          <TextInput
            autoFocus
            value={custom}
            onChangeText={v => setCustom(toEnglishDigits(v).replace(/\D/g, '').slice(0, 3))}
            onSubmitEditing={saveCustom}
            onBlur={saveCustom}
            keyboardType="number-pad"
            placeholder="٪"
            placeholderTextColor={colors.textMuted}
            textAlign="center"
            style={styles.customInput}
          />
        ) : (
          <FilterChip
            label={RATES.includes(pct) ? dict.other : `${toPersianDigits(pct)}٪`}
            active={!RATES.includes(pct)}
            onPress={() => {
              setCustom('');
              setEditing(true);
            }}
          />
        )}
      </View>
    </GlassPanel>
  );
}
