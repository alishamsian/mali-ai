import React from 'react';
import { TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { useAppTheme } from '../../theme/ThemeBridge';
import { useThemedStyles } from '../../theme/useThemedStyles';
import {
  formatAmountDisplay,
  parseIntegerAmount,
  sanitizeAmountDigits,
} from '../../utils/numbers/digits';
import { tomanToPersianWords } from '../../utils/numbers/persianWords';

export function AmountInput({
  value,
  onChangeValue,
  placeholder,
  placeholderTextColor,
  textAlign = 'right',
  style,
  inputStyle,
  showWords = true,
  accessibilityLabel,
}: {
  value: string;
  onChangeValue: (digits: string) => void;
  placeholder?: string;
  placeholderTextColor?: string;
  textAlign?: 'left' | 'right' | 'center';
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  showWords?: boolean;
  accessibilityLabel?: string;
}) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles((c, th) => ({
    input: {
      minHeight: 46,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      color: c.text,
      paddingHorizontal: 14,
      backgroundColor: c.surface,
      fontFamily: th.typography.fontFamily.regular,
    },
    words: {
      marginTop: 6,
      textAlign: 'right' as const,
      color: c.textMuted,
      lineHeight: 20,
    },
  }));

  const toman = parseIntegerAmount(value);
  const words = showWords ? tomanToPersianWords(toman) : null;

  return (
    <View style={style}>
      <TextInput
        value={formatAmountDisplay(value)}
        onChangeText={raw => onChangeValue(sanitizeAmountDigits(raw))}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor ?? colors.textMuted}
        keyboardType="number-pad"
        textAlign={textAlign}
        style={[styles.input, inputStyle]}
        accessibilityLabel={accessibilityLabel}
      />
      {words ? (
        <AppText variant="caption" style={styles.words}>
          {words}
        </AppText>
      ) : null}
    </View>
  );
}

export function AmountField({
  label,
  value,
  onChangeValue,
  placeholder,
  showWords = true,
  style,
  inputStyle,
}: {
  label: string;
  value: string;
  onChangeValue: (digits: string) => void;
  placeholder?: string;
  showWords?: boolean;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}) {
  const styles = useThemedStyles(c => ({
    wrap: { gap: 6 },
    label: { textAlign: 'right' as const, color: c.textMuted, fontSize: 12 },
  }));

  return (
    <View style={[styles.wrap, style]}>
      <AppText style={styles.label}>{label}</AppText>
      <AmountInput
        value={value}
        onChangeValue={onChangeValue}
        placeholder={placeholder}
        showWords={showWords}
        inputStyle={inputStyle}
      />
    </View>
  );
}
