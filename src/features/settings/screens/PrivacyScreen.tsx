import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShieldCheck } from 'lucide-react-native';
import { AppText } from '../../../components/ui/AppText';
import { GlassCard } from '../../../components/ui/GlassCard';
import { t } from '../../../i18n';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';

export function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useThemedStyles(() => ({
    screen: { flex: 1, backgroundColor: 'transparent' },
    hero: { alignItems: 'center', gap: 10, marginBottom: 16 },
    bullet: {
      flexDirection: 'row-reverse',
      alignItems: 'flex-start',
      gap: 10,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    bulletText: { flex: 1, textAlign: 'right', lineHeight: 24 },
    dot: { width: 6, height: 6, borderRadius: 3, marginTop: 9, backgroundColor: colors.primary },
  }));
  const dict = t();
  const bullets = [
    dict.privacy.bullet1,
    dict.privacy.bullet2,
    dict.privacy.bullet3,
    dict.privacy.bullet4,
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + 16, padding: 20, paddingBottom: 40 }}>
      <View style={styles.hero}>
        <ShieldCheck color={colors.primary} size={40} strokeWidth={1.8} />
        <AppText variant="title" style={{ textAlign: 'center' }}>
          {dict.profile.privacy}
        </AppText>
        <AppText style={{ lineHeight: 26, textAlign: 'center', color: colors.textSecondary }}>
          {dict.privacy.lead}
        </AppText>
      </View>
      <GlassCard>
        {bullets.map(line => (
          <View key={line} style={styles.bullet}>
            <AppText style={styles.bulletText}>{line}</AppText>
            <View style={styles.dot} />
          </View>
        ))}
      </GlassCard>
      <AppText variant="caption" style={{ marginTop: 16, lineHeight: 22, textAlign: 'right' }}>
        {dict.sms.privacy}
      </AppText>
    </ScrollView>
  );
}
