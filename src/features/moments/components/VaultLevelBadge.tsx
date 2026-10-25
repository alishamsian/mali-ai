import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../../../components/ui/AppText';
import type { VaultLevel } from '../../../engine/moments/vaultMoments';
import { vaultLevelLabel } from '../../../engine/moments/vaultMoments';

const LEVEL_STYLE: Record<
  Exclude<VaultLevel, 'none'>,
  { bg: string; border: string; text: string }
> = {
  bronze: {
    bg: 'rgba(180,120,70,0.18)',
    border: 'rgba(205,140,80,0.45)',
    text: '#E8C49A',
  },
  silver: {
    bg: 'rgba(180,190,200,0.14)',
    border: 'rgba(200,210,220,0.4)',
    text: '#D8E2EA',
  },
  gold: {
    bg: 'rgba(212,175,55,0.16)',
    border: 'rgba(232,195,90,0.5)',
    text: '#F0D78A',
  },
};

export function VaultLevelBadge({ level }: { level: VaultLevel }) {
  if (level === 'none') {
    return null;
  }
  const look = LEVEL_STYLE[level];
  return (
    <View style={[styles.badge, { backgroundColor: look.bg, borderColor: look.border }]}>
      <AppText style={[styles.text, { color: look.text }]}>{vaultLevelLabel(level)}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  text: {
    fontSize: 10,
    fontFamily: 'Vazirmatn-SemiBold',
  },
});
