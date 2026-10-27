import React, { useEffect } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  Easing,
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import {
  Building2,
  MessageSquareText,
  Receipt,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wallet,
} from 'lucide-react-native';
import { useFinanceStore } from '../../../store/finance/store';
import type { OnboardingSlideConfig } from '../config';
import { useAppTheme } from '../../../theme/ThemeBridge';

function useMotionEnabled(): boolean {
  const reduced = useFinanceStore(s => Boolean(s.snapshot.settings.reducedMotion));
  return !reduced;
}

function OrbitRing({ size, color }: { size: number; color: string }) {
  return (
    <View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1,
        borderColor: color,
        opacity: 0.4,
      }}
    />
  );
}

function Floaty({
  children,
  y = 10,
  duration = 2800,
  delay = 0,
  enabled,
}: {
  children: React.ReactNode;
  y?: number;
  duration?: number;
  delay?: number;
  enabled: boolean;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (!enabled) {
      t.value = 0;
      return;
    }
    t.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
  }, [delay, duration, enabled, t]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(t.value, [0, 1], [0, -y]) }],
  }));
  if (!enabled) {
    return <View>{children}</View>;
  }
  return <Animated.View style={style}>{children}</Animated.View>;
}

function WelcomeScene({ accent, glow, enabled }: { accent: string; glow: string; enabled: boolean }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!enabled) {
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [enabled, pulse]);
  const core = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.05]) }],
    opacity: interpolate(pulse.value, [0, 1], [0.92, 1]),
  }));

  return (
    <View style={styles.scene}>
      <OrbitRing size={220} color={`${accent}55`} />
      <OrbitRing size={178} color={`${accent}33`} />
      <Floaty enabled={enabled}>
        <Animated.View style={[styles.coreOrb, enabled ? core : null, { borderColor: `${accent}44` }]}>
          <LinearGradient colors={[`${accent}44`, `${accent}12`]} style={StyleSheet.absoluteFill} />
          <Wallet color={accent} size={52} strokeWidth={1.8} />
          <View style={styles.sparkleWrap}>
            <Sparkles color={accent} size={18} strokeWidth={2} />
          </View>
        </Animated.View>
      </Floaty>
      {[0, 1, 2].map(i => (
        <Floaty key={i} y={8} delay={i * 320} duration={2400 + i * 200} enabled={enabled}>
          <View
            style={[
              styles.particle,
              { left: 28 + i * 54, top: 36 + (i % 2) * 90, backgroundColor: glow },
            ]}
          />
        </Floaty>
      ))}
    </View>
  );
}

function AutoScene({ accent, enabled }: { accent: string; enabled: boolean }) {
  const flow = useSharedValue(0);
  useEffect(() => {
    if (!enabled) {
      flow.value = 0;
      return;
    }
    flow.value = withRepeat(
      withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.cubic) }),
      -1,
      false,
    );
  }, [enabled, flow]);
  const smsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0, 0.35, 0.7], [1, 0.35, 0]),
    transform: [
      { translateX: interpolate(flow.value, [0, 0.7], [0, -28]) },
      { scale: interpolate(flow.value, [0, 0.7], [1, 0.92]) },
    ],
  }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flow.value, [0.25, 0.55, 1], [0, 1, 1]),
    transform: [
      { translateX: interpolate(flow.value, [0.25, 1], [36, 0]) },
      { scale: interpolate(flow.value, [0.25, 1], [0.88, 1]) },
    ],
  }));

  return (
    <View style={styles.scene}>
      <Floaty enabled={enabled} y={6}>
        <View style={styles.phone}>
          <LinearGradient colors={['#121A20', '#0A1014']} style={StyleSheet.absoluteFill} />
          <View style={styles.phoneGhost}>
            <Smartphone color="rgba(255,255,255,0.25)" size={120} strokeWidth={1} />
          </View>
          {enabled ? (
            <>
              <Animated.View style={[styles.smsBubble, smsStyle]}>
                <MessageSquareText color={accent} size={22} />
                <View style={[styles.smsLine, styles.smsLineWide]} />
                <View style={[styles.smsLine, styles.smsLineMid]} />
              </Animated.View>
              <Animated.View style={[styles.txCard, cardStyle, { borderColor: `${accent}55` }]}>
                <Receipt color={accent} size={20} />
                <View style={[styles.smsLine, styles.smsLineTx]} />
                <View style={[styles.smsLine, styles.smsLineShort]} />
              </Animated.View>
            </>
          ) : (
            <View style={styles.smsBubble}>
              <MessageSquareText color={accent} size={22} />
            </View>
          )}
        </View>
      </Floaty>
    </View>
  );
}

function BankFanCard({
  rot,
  colors,
  x,
  index,
  fan,
  enabled,
}: {
  rot: number;
  colors: [string, string];
  x: number;
  index: number;
  fan: SharedValue<number>;
  enabled: boolean;
}) {
  const cardStyle = useAnimatedStyle(() => {
    if (!enabled) {
      return {
        transform: [
          { translateX: x },
          { rotate: `${rot}deg` },
          { translateY: index * 10 },
        ],
      };
    }
    return {
      transform: [
        { translateX: interpolate(fan.value, [0, 1], [0, x]) },
        { rotate: `${interpolate(fan.value, [0, 1], [0, rot])}deg` },
        { translateY: interpolate(fan.value, [0, 1], [index * 4, index * 10]) },
      ],
    };
  });
  return (
    <Animated.View style={[styles.bankCard, cardStyle, { zIndex: index, marginTop: index * -52 }]}>
      <LinearGradient colors={colors} style={StyleSheet.absoluteFill} />
      <Building2 color="rgba(255,255,255,0.75)" size={22} />
      <View style={styles.cardChip} />
      <View style={[styles.smsLine, styles.smsLineBank]} />
    </Animated.View>
  );
}

function BanksScene({ accent, enabled }: { accent: string; enabled: boolean }) {
  const fan = useSharedValue(enabled ? 0 : 1);
  useEffect(() => {
    if (!enabled) {
      fan.value = 1;
      return;
    }
    fan.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2600, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [enabled, fan]);

  const cards = [
    { rot: -14, colors: ['#4A0E1A', '#A01D36'] as [string, string], x: -34 },
    { rot: 0, colors: ['#0A2A4A', '#1A5694'] as [string, string], x: 0 },
    { rot: 14, colors: ['#0B3D2E', '#1B7A45'] as [string, string], x: 34 },
  ];

  return (
    <View style={styles.scene}>
      {cards.map((c, i) => (
        <BankFanCard
          key={c.rot}
          rot={c.rot}
          colors={c.colors}
          x={c.x}
          index={i}
          fan={fan}
          enabled={enabled}
        />
      ))}
      <View style={[styles.goldFilament, { backgroundColor: `${accent}44` }]} />
    </View>
  );
}

function PrivacyScene({ accent, enabled }: { accent: string; enabled: boolean }) {
  const scan = useSharedValue(0);
  useEffect(() => {
    if (!enabled) {
      scan.value = 0;
      return;
    }
    scan.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
  }, [enabled, scan]);
  const beam = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(scan.value, [0, 1], [-70, 70]) }],
    opacity: interpolate(scan.value, [0, 0.5, 1], [0.2, 0.75, 0.2]),
  }));

  return (
    <View style={styles.scene}>
      <Floaty enabled={enabled}>
        <View style={[styles.shieldWrap, { borderColor: `${accent}44` }]}>
          <LinearGradient colors={[`${accent}22`, 'rgba(0,0,0,0)']} style={StyleSheet.absoluteFill} />
          <ShieldCheck color={accent} size={72} strokeWidth={1.6} />
          {enabled ? (
            <Animated.View style={[styles.scanBeam, beam, { backgroundColor: accent }]} />
          ) : null}
          <View style={styles.phoneMini}>
            <Smartphone color="rgba(255,255,255,0.7)" size={28} strokeWidth={1.8} />
          </View>
        </View>
      </Floaty>
    </View>
  );
}

function Scene({ slide, enabled }: { slide: OnboardingSlideConfig; enabled: boolean }) {
  switch (slide.id) {
    case 'welcome':
      return <WelcomeScene accent={slide.accent} glow={slide.accentGlow} enabled={enabled} />;
    case 'auto':
      return <AutoScene accent={slide.accent} enabled={enabled} />;
    case 'banks':
      return <BanksScene accent={slide.accent} enabled={enabled} />;
    case 'privacy':
      return <PrivacyScene accent={slide.accent} enabled={enabled} />;
    default:
      return null;
  }
}

export function OnboardingIllustration({
  slide,
  imageSource,
  active,
}: {
  slide: OnboardingSlideConfig;
  imageSource?: ImageSourcePropType;
  active: boolean;
}) {
  const motion = useMotionEnabled();
  const { mode } = useAppTheme();
  // The scenes are drawn for a dark stage; on the glass daylight page they sit in an ink card.
  const stage = mode === 'light' ? '#111316' : 'rgba(255,255,255,0.03)';

  if (!active) {
    return <View style={styles.placeholder} />;
  }

  if (imageSource) {
    return (
      <Animated.View entering={FadeIn.duration(400)} style={styles.imageWrap}>
        <Image source={imageSource} style={styles.heroImage} resizeMode="cover" />
        <LinearGradient colors={['transparent', 'rgba(4,6,8,0.85)']} style={styles.imageFade} />
      </Animated.View>
    );
  }

  return (
    <View style={[styles.illustration, { borderColor: `${slide.accent}33`, backgroundColor: stage }]}>
      <LinearGradient colors={[`${slide.accent}18`, 'rgba(4,6,8,0)']} style={StyleSheet.absoluteFill} />
      <Scene slide={slide} enabled={motion} />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    width: '100%',
    height: 300,
  },
  illustration: {
    width: '100%',
    height: 300,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  imageWrap: {
    width: '100%',
    height: 300,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  heroImage: { width: '100%', height: '100%' },
  imageFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
  },
  scene: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coreOrb: {
    width: 118,
    height: 118,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  sparkleWrap: {
    position: 'absolute',
    top: 18,
    left: 22,
    opacity: 0.85,
  },
  particle: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  phone: {
    width: 200,
    height: 240,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneGhost: { position: 'absolute', opacity: 0.35 },
  smsBubble: {
    position: 'absolute',
    top: 52,
    right: 22,
    width: 118,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    gap: 8,
  },
  txCard: {
    position: 'absolute',
    bottom: 42,
    left: 24,
    width: 132,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    gap: 8,
  },
  smsLine: {
    height: 6,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  smsLineWide: { width: 72 },
  smsLineMid: { width: 48, opacity: 0.5 },
  smsLineTx: { width: 72, backgroundColor: 'rgba(255,255,255,0.35)' },
  smsLineShort: { width: 40, opacity: 0.45 },
  smsLineBank: { width: 72, marginTop: 18, opacity: 0.35 },
  bankCard: {
    width: 196,
    height: 118,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
  },
  cardChip: {
    marginTop: 14,
    width: 34,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(255,220,120,0.55)',
  },
  goldFilament: {
    position: 'absolute',
    bottom: 24,
    width: 120,
    height: 3,
    borderRadius: 2,
    opacity: 0.7,
  },
  shieldWrap: {
    width: 168,
    height: 188,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  scanBeam: {
    position: 'absolute',
    width: '80%',
    height: 2,
    borderRadius: 2,
  },
  phoneMini: {
    position: 'absolute',
    bottom: 22,
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
});
