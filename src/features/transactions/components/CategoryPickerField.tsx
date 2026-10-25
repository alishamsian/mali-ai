import React, { useMemo } from 'react';
import { View } from 'react-native';
import { AppText } from '../../../components/ui/AppText';
import { PickerField, flatPickerSections, type PickerItem } from '../../../components/ui/PickerField';
import { CATEGORY_COLOR } from '../../../theme/accents';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { t } from '../../../i18n';
import type { CategoryId } from '../../../types/finance';

export function CategoryPickerField({
  categories,
  selectedId,
  onSelect,
  label,
  placeholder,
  title,
  searchPlaceholder,
  allowAll,
  allId = 'all',
  allLabel,
}: {
  categories: CategoryId[];
  selectedId?: CategoryId | 'all' | null;
  onSelect: (id: CategoryId | 'all') => void;
  label?: string;
  placeholder?: string;
  title?: string;
  searchPlaceholder?: string;
  allowAll?: boolean;
  allId?: 'all';
  allLabel?: string;
}) {
  const dict = t();
  const styles = useThemedStyles(c => ({
    block: { gap: 8 },
    fieldLabel: {
      textAlign: 'right' as const,
      color: c.textMuted,
      paddingHorizontal: 2,
    },
    fieldRow: {
      flexDirection: 'row-reverse' as const,
      alignItems: 'center' as const,
      gap: 10,
    },
    dot: { width: 10, height: 10, borderRadius: 5 },
  }));

  const sections = useMemo(() => {
    const items: PickerItem<CategoryId | 'all'>[] = [];
    if (allowAll) {
      items.push({
        id: allId,
        label: allLabel ?? dict.picker.allCategories,
        keywords: 'all',
      });
    }
    for (const id of categories) {
      items.push({
        id,
        label: dict.categories[id],
        accent: CATEGORY_COLOR[id],
        keywords: id,
      });
    }
    return flatPickerSections(items);
  }, [allId, allLabel, allowAll, categories, dict.categories, dict.picker.allCategories]);

  const selected = useMemo(() => {
    for (const section of sections) {
      const hit = section.items.find(item => item.id === selectedId);
      if (hit) {
        return hit;
      }
    }
    return undefined;
  }, [sections, selectedId]);

  return (
    <View style={styles.block}>
      {label ? (
        <AppText variant="caption" style={styles.fieldLabel}>
          {label}
        </AppText>
      ) : null}
      <PickerField
        selectedId={selectedId}
        onSelect={onSelect}
        sections={sections}
        title={title ?? dict.picker.pickCategoryTitle}
        placeholder={placeholder ?? dict.picker.selectCategory}
        searchPlaceholder={searchPlaceholder ?? dict.picker.searchCategory}
        renderValue={() =>
          selected ? (
            <View style={styles.fieldRow}>
              {selected.accent ? (
                <View style={[styles.dot, { backgroundColor: selected.accent }]} />
              ) : null}
              <AppText variant="label" style={{ textAlign: 'right', flex: 1 }}>
                {selected.label}
              </AppText>
            </View>
          ) : null
        }
      />
    </View>
  );
}
