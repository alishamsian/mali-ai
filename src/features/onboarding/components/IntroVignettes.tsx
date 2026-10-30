import React from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import {
  ArrowDown,
  Check,
  Coffee,
  Lock,
  MessageSquareText,
  ShieldCheck,
  Smartphone,
} from 'lucide-react-native';
import { AppText } from '../../../components/ui/AppText';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { t } from '../../../i18n';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';

/**
 * Small, live pieces of the real app for the intro pages, so the first thing a new user
 * sees is what Polt actually looks like, not abstract art. They animate in each time
 * their page appears (parents key them by page).
 */

const enter = (i: number) =>
  FadeInDown.delay(120 + i * 140)
    .springify()
    .damping(16);

function useStyles() {
  return useThemedStyles((c, th) => ({
    stage: { width: '100%', maxWidth: 340, alignSelf: 'center', gap: 12 },
    card: { padding: 18, gap: 8 },
    kicker: { textAlign: 'right', color: c.textMuted, fontSize: 12 },
    big: {
      textAlign: 'right',
      color: c.text,
      fontSize: 30,
      fontFamily: th.typography.fontFamily.bold,
    },
    chip: {
      alignSelf: 'flex-end',
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 5,
      backgroundColor: c.highlight,
    },
    chipText: { color: c.onHighlight, fontSize: 12, fontFamily: th.typography.fontFamily.semibold },
    row: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, padding: 14 },
    icon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    main: { flex: 1, gap: 2 },
    title: { textAlign: 'right', color: c.text, fontFamily: th.typography.fontFamily.semibold },
    sub: { textAlign: 'right', color: c.textMuted, fontSize: 12 },
    amount: { color: c.text, fontFamily: th.typography.fontFamily.semibold },
    bars: { flexDirection: 'row-reverse', alignItems: 'flex-end', gap: 6, height: 44 },
    bar: { flex: 1, borderRadius: 6 },
    sms: { padding: 14, gap: 4, borderTopRightRadius: 6 },
    smsText: { textAlign: 'right', color: c.textSecondary, fontSize: 13, lineHeight: 22 },
    arrow: { alignSelf: 'center' },
    shield: {
      width: 88,
      height: 88,
      borderRadius: 30,
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
    },
    check: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, paddingVertical: 4 },
    checkText: { flex: 1, textAlign: 'right', color: c.text, fontSize: 14 },
  }));
}

/** Page 1: the whole picture at a glance. */
export function OverviewVignette() {
  const s = useStyles();
  const { colors } = useAppTheme();
  const dict = t().onboarding;
  const heights = [0.45, 0.7, 0.35, 0.9, 0.55, 0.3, 0.65];
  return (
    <View style={s.stage}>
      <Animated.View entering={enter(0)}>
        <GlassPanel strong radius={28} style={s.card}>
          <AppText style={s.kicker}>{dict.demoBalanceLabel}</AppText>
          <AppText style={s.big}>{dict.demoBalance}</AppText>
          <View style={s.chip}>
            <AppText style={s.chipText}>{dict.demoAllowance}</AppText>
          </View>
        </GlassPanel>
      </Animated.View>
      <Animated.View entering={enter(1)}>
        <GlassPanel radius={24} style={[s.card, { paddingVertical: 14 }]}>
          <AppText style={s.kicker}>{dict.demoWeek}</AppText>
          <View style={s.bars}>
            {heights.map((h, i) => (
              <View
                key={i}
                style={[
                  s.bar,
                  {
                    height: `${h * 100}%`,
                    backgroundColor: i === 3 ? colors.highlight : colors.glassBorder,
                  },
                ]}
              />
            ))}
          </View>
        </GlassPanel>
      </Animated.View>
    </View>
  );
}

/** Page 2: a bank SMS becomes a transaction on its own. */
export function AutoVignette() {
  const s = useStyles();
  const { colors } = useAppTheme();
  const dict = t().onboarding;
  return (
    <View style={s.stage}>
      <Animated.View entering={enter(0)}>
        <GlassPanel radius={22} style={s.sms}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
            <MessageSquareText size={14} color={colors.textMuted} />
            <AppText style={s.kicker}>{dict.demoSmsFrom}</AppText>
          </View>
          <AppText style={s.smsText}>{dict.demoSms}</AppText>
        </GlassPanel>
      </Animated.View>
      <Animated.View entering={FadeIn.delay(420)} style={s.arrow}>
        <ArrowDown size={22} color={colors.textMuted} />
      </Animated.View>
      <Animated.View entering={enter(3)}>
        <GlassPanel strong radius={22} style={s.row}>
          <View style={[s.icon, { backgroundColor: colors.highlight }]}>
            <Coffee size={20} color={colors.onHighlight} />
          </View>
          <View style={s.main}>
            <AppText style={s.title}>{dict.demoMerchant}</AppText>
            <AppText style={s.sub}>{dict.demoAuto}</AppText>
          </View>
          <AppText style={s.amount}>{dict.demoAmount}</AppText>
        </GlassPanel>
      </Animated.View>
    </View>
  );
}

/** Page 3: it all stays on this phone. */
export function PrivacyVignette() {
  const s = useStyles();
  const { colors } = useAppTheme();
  const dict = t().onboarding;
  const points: [typeof Lock, string][] = [
    [Smartphone, dict.trust1],
    [Lock, dict.trust2],
    [Check, dict.trust3],
  ];
  return (
    <View style={s.stage}>
      <Animated.View entering={FadeIn.duration(420)} style={s.shield}>
        <ShieldCheck size={44} color={colors.onPrimary} strokeWidth={1.6} />
      </Animated.View>
      <GlassPanel radius={24} style={[s.card, { marginTop: 8 }]}>
        {points.map(([Icon, text], i) => (
          <Animated.View key={text} entering={FadeInUp.delay(260 + i * 140)} style={s.check}>
            <Icon size={18} color={colors.income} />
            <AppText style={s.checkText}>{text}</AppText>
          </Animated.View>
        ))}
      </GlassPanel>
    </View>
  );
}
