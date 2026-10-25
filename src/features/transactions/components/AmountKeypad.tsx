import React from 'react';
import { StyleSheet } from 'react-native';
import { Delete } from 'lucide-react-native';
import { AppText } from '../../../components/ui/AppText';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { PressScale } from '../../../components/ui/PressScale';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { theme } from '../../../theme';
import { t } from '../../../i18n';
import { hapticTap } from '../../../utils/haptics';

const MAX_DIGITS = 12;

/** Pure digit-string reducer so the keypad behaviour is testable without React. */
export function applyKey(digits: string, key: string): string {
  if (key === 'del') {
    return digits.slice(0, -1);
  }
  if (key === 'clear') {
    return '';
  }
  const next = (digits + key).replace(/^0+/, '');
  return next.length > MAX_DIGITS ? digits : next;
}

const KEYS: { value: string; label: string }[] = [
  { value: '1', label: '۱' },
  { value: '2', label: '۲' },
  { value: '3', label: '۳' },
  { value: '4', label: '۴' },
  { value: '5', label: '۵' },
  { value: '6', label: '۶' },
  { value: '7', label: '۷' },
  { value: '8', label: '۸' },
  { value: '9', label: '۹' },
  { value: '000', label: '۰۰۰' },
  { value: '0', label: '۰' },
  { value: 'del', label: '' },
];

/**
 * Glass number pad laid out like a phone dialer (1-2-3 left to right, as on Persian phones too).
 * `000` speeds up toman entry; long-press on delete clears the amount.
 */
export function AmountKeypad({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const { colors } = useAppTheme();
  const dict = t();
  const press = (key: string) => {
    hapticTap();
    onChange(applyKey(value, key));
  };
  return (
    <GlassPanel radius={28} style={styles.pad}>
      {KEYS.map(k => (
        <PressScale
          key={k.value}
          style={styles.cell}
          onPress={() => press(k.value)}
          onLongPress={k.value === 'del' ? () => press('clear') : undefined}
          accessibilityRole="button"
          accessibilityLabel={
            k.value === 'del'
              ? dict.add.keyDelete
              : k.value === '000'
              ? dict.add.keyThousand
              : k.label
          }>
          <GlassPanel strong radius={18} style={styles.key}>
            {k.value === 'del' ? (
              <Delete color={colors.text} size={22} strokeWidth={1.8} />
            ) : (
              <AppText style={[styles.keyLabel, { color: colors.text }]}>{k.label}</AppText>
            )}
          </GlassPanel>
        </PressScale>
      ))}
    </GlassPanel>
  );
}

const styles = StyleSheet.create({
  pad: { flexDirection: 'row', flexWrap: 'wrap', padding: 8, gap: 8 },
  cell: { width: '31.4%', flexGrow: 1 },
  key: { height: 52, alignItems: 'center', justifyContent: 'center' },
  keyLabel: { fontSize: 22, lineHeight: 32, fontFamily: theme.typography.fontFamily.medium },
});
