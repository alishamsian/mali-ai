import React, { useMemo } from 'react';
import { View } from 'react-native';
import { AppText } from './AppText';
import { PickerField, flatPickerSections, type PickerItem } from './PickerField';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { t } from '../../i18n';

export function OptionPickerField<T extends string>({
  label,
  options,
  value,
  onChange,
  labelOf,
  title,
  placeholder,
  searchPlaceholder,
  searchable,
}: {
  label?: string;
  options: T[];
  value: T;
  onChange: (v: T) => void;
  labelOf: (v: T) => string;
  title?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  searchable?: boolean;
}) {
  const dict = t();
  const styles = useThemedStyles(c => ({
    block: { gap: 8 },
    fieldLabel: {
      textAlign: 'right' as const,
      color: c.textMuted,
      paddingHorizontal: 2,
    },
  }));

  const sections = useMemo(
    () =>
      flatPickerSections(
        options.map(
          (id): PickerItem<T> => ({
            id,
            label: labelOf(id),
            keywords: id,
          }),
        ),
      ),
    [labelOf, options],
  );

  return (
    <View style={styles.block}>
      {label ? (
        <AppText variant="caption" style={styles.fieldLabel}>
          {label}
        </AppText>
      ) : null}
      <PickerField
        selectedId={value}
        onSelect={onChange}
        sections={sections}
        title={title ?? label ?? dict.picker.selectOption}
        placeholder={placeholder ?? dict.picker.selectOption}
        searchPlaceholder={searchPlaceholder}
        searchable={searchable ?? options.length > 6}
      />
    </View>
  );
}
