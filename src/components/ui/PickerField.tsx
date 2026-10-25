import React, { type ReactNode, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronDown, X } from 'lucide-react-native';
import { AppText } from './AppText';
import { PressScale } from './PressScale';
import { useAppTheme } from '../../theme/ThemeBridge';
import { useThemedStyles } from '../../theme/useThemedStyles';

export type PickerItem<T extends string = string> = {
  id: T;
  label: string;
  subtitle?: string;
  leading?: ReactNode;
  accent?: string;
  keywords?: string;
};

export type PickerSection<T extends string = string> = {
  id: string;
  title?: string;
  items: PickerItem<T>[];
};

export function flatPickerSections<T extends string>(items: PickerItem<T>[]): PickerSection<T>[] {
  return items.length ? [{ id: 'all', items }] : [];
}

function PickerSheetList<T extends string>({
  selectedId,
  onSelect,
  sections,
  searchPlaceholder,
  searchable,
}: {
  selectedId?: T | null;
  onSelect: (id: T) => void;
  sections: PickerSection<T>[];
  searchPlaceholder?: string;
  searchable?: boolean;
}) {
  const { colors } = useAppTheme();
  const [query, setQuery] = useState('');
  const styles = useThemedStyles((c, th) => ({
    search: {
      minHeight: 46,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      color: c.text,
      paddingHorizontal: 14,
      backgroundColor: c.surface,
      fontFamily: th.typography.fontFamily.regular,
      marginBottom: 14,
    },
    section: { marginBottom: 16, gap: 4 },
    sectionTitle: {
      textAlign: 'right' as const,
      color: c.textMuted,
      marginBottom: 6,
      paddingHorizontal: 4,
    },
    row: {
      flexDirection: 'row-reverse' as const,
      alignItems: 'center' as const,
      gap: 12,
      paddingVertical: 11,
      paddingHorizontal: 12,
      borderRadius: 14,
    },
    rowOn: { backgroundColor: th.palette.primaryGlow },
    rowMeta: { flex: 1, gap: 2 },
    accentDot: { width: 10, height: 10, borderRadius: 5 },
    check: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    checkOn: { borderColor: c.primary, backgroundColor: c.primary },
  }));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return sections;
    }
    return sections
      .map(section => ({
        ...section,
        items: section.items.filter(item => {
          const hay = `${item.label} ${item.subtitle ?? ''} ${item.keywords ?? ''} ${item.id}`.toLowerCase();
          return hay.includes(q);
        }),
      }))
      .filter(section => section.items.length > 0);
  }, [query, sections]);

  return (
    <View>
      {searchable !== false ? (
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={searchPlaceholder}
          placeholderTextColor={colors.textMuted}
          textAlign="right"
          style={styles.search}
          autoCorrect={false}
        />
      ) : null}
      {filtered.map(section => (
        <View key={section.id} style={styles.section}>
          {section.title ? (
            <AppText variant="caption" style={styles.sectionTitle}>
              {section.title}
            </AppText>
          ) : null}
          {section.items.map(item => {
            const on = selectedId === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => onSelect(item.id)}
                style={[styles.row, on && styles.rowOn]}>
                {item.leading}
                {item.accent ? (
                  <View style={[styles.accentDot, { backgroundColor: item.accent }]} />
                ) : null}
                <View style={styles.rowMeta}>
                  <AppText variant="label" style={{ textAlign: 'right' }}>
                    {item.label}
                  </AppText>
                  {item.subtitle ? (
                    <AppText variant="caption" style={{ textAlign: 'right' }} numberOfLines={1}>
                      {item.subtitle}
                    </AppText>
                  ) : null}
                </View>
                <View style={[styles.check, on && styles.checkOn]}>
                  {on ? <Check size={14} color="#05201c" strokeWidth={3} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export function PickerField<T extends string>({
  selectedId,
  onSelect,
  sections,
  placeholder,
  title,
  searchPlaceholder,
  searchable,
  renderValue,
}: {
  selectedId?: T | null;
  onSelect: (id: T) => void;
  sections: PickerSection<T>[];
  placeholder?: string;
  title?: string;
  searchPlaceholder?: string;
  searchable?: boolean;
  renderValue?: (item: PickerItem<T> | undefined) => ReactNode;
}) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const styles = useThemedStyles(c => ({
    field: {
      flexDirection: 'row-reverse' as const,
      alignItems: 'center' as const,
      gap: 12,
      minHeight: 56,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surfaceSolid,
    },
    fieldMeta: { flex: 1, gap: 3 },
    placeholder: { color: c.textMuted, textAlign: 'right' as const },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    sheet: {
      maxHeight: height * 0.82,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      backgroundColor: c.surfaceSolid,
      borderWidth: 1,
      borderColor: c.border,
      borderBottomWidth: 0,
      paddingHorizontal: 18,
      paddingTop: 10,
    },
    handle: {
      alignSelf: 'center' as const,
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
      marginBottom: 14,
    },
    sheetHead: {
      flexDirection: 'row-reverse' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
      marginBottom: 12,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
  }));

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
    <>
      <PressScale onPress={() => setOpen(true)} style={styles.field}>
        {selected ? (
          renderValue ? (
            <View style={styles.fieldMeta}>{renderValue(selected)}</View>
          ) : (
            <View style={styles.fieldMeta}>
              <AppText variant="label" style={{ textAlign: 'right' }}>
                {selected.label}
              </AppText>
              {selected.subtitle ? (
                <AppText variant="caption" style={{ textAlign: 'right' }} numberOfLines={1}>
                  {selected.subtitle}
                </AppText>
              ) : null}
            </View>
          )
        ) : (
          <AppText variant="body" style={[styles.placeholder, { flex: 1 }]}>
            {placeholder}
          </AppText>
        )}
        <ChevronDown size={20} color={colors.textMuted} strokeWidth={2} />
      </PressScale>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.handle} />
            <View style={styles.sheetHead}>
              <AppText variant="title" style={{ textAlign: 'right', flex: 1 }}>
                {title}
              </AppText>
              <Pressable onPress={() => setOpen(false)} style={styles.closeBtn} hitSlop={8}>
                <X size={18} color={colors.textMuted} strokeWidth={2} />
              </Pressable>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 8 }}>
              <PickerSheetList
                selectedId={selectedId}
                onSelect={id => {
                  onSelect(id);
                  setOpen(false);
                }}
                sections={sections}
                searchPlaceholder={searchPlaceholder}
                searchable={searchable}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
