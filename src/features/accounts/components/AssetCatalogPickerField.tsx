import React, { useMemo } from 'react';
import { View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { AppText } from '../../../components/ui/AppText';
import { PickerField, type PickerItem, type PickerSection } from '../../../components/ui/PickerField';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { t } from '../../../i18n';
import { ASSET_CATALOG } from '../catalog/assets';
import type { AssetId } from '../../../types/finance';

const GROUP_LABELS: Record<(typeof ASSET_CATALOG)[number]['group'], string> = {
  metal: 'فلزات گران‌بها',
  fiat: 'ارز',
  crypto: 'رمزارز',
  other: 'سایر',
};

function assetLeading(item: (typeof ASSET_CATALOG)[number], symTextStyle: object) {
  return (
    <LinearGradient
      colors={[...item.theme.gradient]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <AppText style={[symTextStyle, { color: item.theme.ink }]}>{item.symbol}</AppText>
    </LinearGradient>
  );
}

export function AssetCatalogPickerField({
  selectedId,
  onSelect,
  placeholder,
  title,
  searchPlaceholder,
}: {
  selectedId: AssetId;
  onSelect: (id: AssetId) => void;
  placeholder?: string;
  title?: string;
  searchPlaceholder?: string;
}) {
  const dict = t();
  const styles = useThemedStyles((_, theme) => ({
    fieldRow: {
      flexDirection: 'row-reverse' as const,
      alignItems: 'center' as const,
      gap: 12,
    },
    symText: { fontSize: 14, fontFamily: theme.typography.fontFamily.semibold },
  }));

  const sections = useMemo(() => {
    const byGroup = new Map<string, PickerItem<AssetId>[]>();
    for (const item of ASSET_CATALOG) {
      const list = byGroup.get(item.group) ?? [];
      list.push({
        id: item.id,
        label: dict.accounts.assets[item.id],
        subtitle: item.symbol,
        keywords: `${item.id} ${item.symbol} ${item.mark}`,
        leading: assetLeading(item, styles.symText),
      });
      byGroup.set(item.group, list);
    }
    return [...byGroup.entries()].map(
      ([group, items]): PickerSection<AssetId> => ({
        id: group,
        title: GROUP_LABELS[group as keyof typeof GROUP_LABELS],
        items,
      }),
    );
  }, [dict.accounts.assets, styles.symText]);

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
    <PickerField
      selectedId={selectedId}
      onSelect={onSelect}
      sections={sections}
      title={title ?? dict.picker.pickAssetTitle}
      placeholder={placeholder ?? dict.picker.selectAsset}
      searchPlaceholder={searchPlaceholder ?? dict.picker.searchAsset}
      renderValue={() =>
        selected ? (
          <View style={styles.fieldRow}>
            {selected.leading}
            <AppText variant="label" style={{ textAlign: 'right', flex: 1 }}>
              {selected.label}
            </AppText>
          </View>
        ) : null
      }
    />
  );
}
