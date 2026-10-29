import React from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import { Moon, Share2, Sparkles, X } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import { AppText } from '../../../components/ui/AppText';
import { PressScale } from '../../../components/ui/PressScale';
import { useAppTheme } from '../../../theme/ThemeBridge';
import type { DashboardMoment } from '../../../engine/moments/buildMoments';

const TONE_GRADIENT: Record<DashboardMoment['tone'], [string, string]> = {
  calm: ['rgba(30,40,80,0.95)', 'rgba(8,12,20,0.98)'],
  celebrate: ['rgba(16,48,40,0.92)', 'rgba(6,14,12,0.98)'],
  story: ['rgba(40,28,16,0.92)', 'rgba(12,10,8,0.98)'],
  wit: ['rgba(48,24,56,0.9)', 'rgba(14,8,18,0.98)'],
  season: ['rgba(20,36,52,0.92)', 'rgba(8,12,18,0.98)'],
};

export function MomentCard({
  moment,
  onDismiss,
}: {
  moment: DashboardMoment;
  onDismiss: (id: string) => void;
}) {
  const { colors } = useAppTheme();
  const grad = TONE_GRADIENT[moment.tone];

  const share = () => {
    void Share.share({
      message: `${moment.title}\n${moment.body}`,
      title: moment.title,
    });
  };

  return (
    <LinearGradient colors={grad} style={styles.card}>
      <View style={styles.top}>
        {moment.tone === 'calm' ? (
          <Moon color={colors.filament} size={18} />
        ) : (
          <Sparkles color={colors.primary} size={18} />
        )}
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => onDismiss(moment.id)} hitSlop={12} accessibilityRole="button" accessibilityLabel="بستن">
          <X color={colors.textMuted} size={16} />
        </Pressable>
      </View>
      <AppText variant="kicker" style={[styles.title, moment.tone === 'calm' && { color: colors.filament }]}>
        {moment.title}
      </AppText>
      <AppText style={styles.body}>{moment.body}</AppText>
      {moment.shareable ? (
        <PressScale onPress={share} style={styles.share}>
          <Share2 color={colors.primary} size={14} />
          <AppText variant="caption" style={{ color: colors.primary }}>
            اشتراک
          </AppText>
        </PressScale>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  top: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 8 },
  title: { textAlign: 'right', marginBottom: 8 },
  body: { textAlign: 'right', lineHeight: 26, color: 'rgba(243,241,234,0.88)' },
  share: {
    marginTop: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
});
