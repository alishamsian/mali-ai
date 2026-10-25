import React, { useEffect } from 'react';
import { View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  Bitcoin,
  Building2,
  Car,
  CircleDollarSign,
  Coins,
  Gem,
  Landmark,
  PieChart,
  TrendingUp,
  Wallet,
} from 'lucide-react-native';
import { AppText } from '../../../components/ui/AppText';
import { BankPlasticCard } from '../../../components/banks/BankPlasticCard';
import { PressScale } from '../../../components/ui/PressScale';
import { formatTomanFromRial } from '../../../utils/currency/money';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { useFinanceStore } from '../../../store/finance/store';
import type { FinancialAccount } from '../../../types/finance';
import type { AssetClass } from '../../../types/wealth';
import { ASSET_CLASS_META, resolveAssetClass } from '../catalog/classes';
import { holdingPerformance } from '../engine/portfolio';
import { t } from '../../../i18n';
import { toPersianDigits } from '../../../utils/numbers/digits';

function secondaryMetric(account: FinancialAccount): string {
  const dict = t();
  const d = account.details;
  if (!d) {
    return '';
  }
  switch (d.class) {
    case 'gold':
      return `${toPersianDigits(String(d.weight))} ${dict.wealth.goldUnits[d.unit]} · ${dict.wealth.goldTypes[d.goldType]}`;
    case 'silver':
      return `${toPersianDigits(String(d.weight))} ${dict.wealth.silverUnits[d.unit]}`;
    case 'crypto':
      return `${toPersianDigits(String(d.quantity))} ${d.symbol}`;
    case 'currency':
      return `${toPersianDigits(String(d.amount))} ${d.currencyCode}`;
    case 'stock':
      return `${toPersianDigits(String(d.quantity))} ${d.symbol}`;
    case 'fund':
      return `${toPersianDigits(String(d.units))} ${dict.wealth.units}`;
    case 'real_estate':
      return `${toPersianDigits(String(d.areaSqm))} ${dict.wealth.sqm} · ${toPersianDigits(String(d.ownershipPercent))}٪`;
    case 'vehicle':
      return `${d.brand} ${d.model} · ${toPersianDigits(String(d.year))}`;
    case 'business':
      return `${toPersianDigits(String(d.ownershipPercent))}٪ ${dict.wealth.ownership}`;
    case 'bank':
      return d.cardLast4 ? `•••• ${toPersianDigits(d.cardLast4)}` : dict.wealth.classes.bank;
    case 'cash':
      return d.currency;
    case 'jewelry':
      return dict.wealth.classes.jewelry;
    case 'collectible':
      return dict.wealth.classes.collectible;
    default:
      return '';
  }
}

function ClassGlyph({ cls, color }: { cls: AssetClass; color: string }) {
  const props = { size: 22, color, strokeWidth: 2 } as const;
  switch (cls) {
    case 'gold':
      return <Coins {...props} />;
    case 'silver':
      return <Coins {...props} />;
    case 'crypto':
      return <Bitcoin {...props} />;
    case 'currency':
      return <CircleDollarSign {...props} />;
    case 'stock':
      return <TrendingUp {...props} />;
    case 'fund':
      return <PieChart {...props} />;
    case 'real_estate':
      return <Building2 {...props} />;
    case 'vehicle':
      return <Car {...props} />;
    case 'business':
      return <Landmark {...props} />;
    case 'jewelry':
      return <Gem {...props} />;
    case 'collectible':
      return <Gem {...props} />;
    case 'cash':
      return <Wallet {...props} />;
    case 'bank':
      return <Landmark {...props} />;
    default:
      return <Wallet {...props} />;
  }
}

function useCardEntrance(index: number, reduced: boolean) {
  const progress = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(
      Math.min(index, 12) * 55,
      withSpring(1, { damping: 18, stiffness: 160 }),
    );
  }, [index, progress, reduced]);
  return useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [14, 0]) },
      { scale: interpolate(progress.value, [0, 1], [0.97, 1]) },
    ],
  }));
}

function useShine(reduced: boolean) {
  const x = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      return;
    }
    x.value = withRepeat(
      withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
  }, [reduced, x]);
  return useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [0, 0.35, 0.55, 1], [0, 0, 0.35, 0]),
    transform: [{ translateX: interpolate(x.value, [0, 1], [-80, 220]) }, { rotate: '-18deg' }],
  }));
}

function usePulse(reduced: boolean) {
  const p = useSharedValue(1);
  useEffect(() => {
    if (reduced) {
      return;
    }
    p.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [p, reduced]);
  return useAnimatedStyle(() => ({ transform: [{ scale: p.value }] }));
}

function ValueBlock({
  account,
  hidden,
  light,
}: {
  account: FinancialAccount;
  hidden: boolean;
  light?: boolean;
}) {
  const dict = t();
  const { colors } = useAppTheme();
  const styles = useThemedStyles((_colors, theme) => ({
    values: { alignItems: 'flex-start' as const, minWidth: 88, maxWidth: 128 },
    value: {
      fontSize: 15,
      fontFamily: theme.typography.fontFamily.semibold,
      writingDirection: 'ltr' as const,
      textAlign: 'left' as const,
    },
    pl: {
      marginTop: 3,
      fontSize: 12,
      fontFamily: theme.typography.fontFamily.semibold,
      writingDirection: 'ltr' as const,
      textAlign: 'left' as const,
    },
    liq: { marginTop: 3, fontSize: 11, textAlign: 'left' as const },
  }));
  const cls = resolveAssetClass(account);
  const meta = ASSET_CLASS_META[cls];
  const perf = holdingPerformance(account);
  const plPositive = (perf.unrealizedPlPct ?? 0) >= 0;
  const text = light ? 'rgba(255,255,255,0.95)' : colors.text;
  const muted = light ? 'rgba(255,255,255,0.62)' : colors.textMuted;

  return (
    <View style={styles.values}>
      <AppText style={[styles.value, { color: text }]}>
        {hidden ? '••••••' : formatTomanFromRial(perf.netValueRial)}
      </AppText>
      {perf.supportsPl && perf.unrealizedPlPct != null ? (
        <AppText
          style={[
            styles.pl,
            {
              color: light
                ? plPositive
                  ? '#A7F3D0'
                  : '#FECACA'
                : plPositive
                  ? colors.income
                  : colors.expense,
            },
          ]}>
          {hidden
            ? '••'
            : `${plPositive ? '+' : ''}${toPersianDigits(perf.unrealizedPlPct.toFixed(1))}٪`}
        </AppText>
      ) : (
        <AppText style={[styles.liq, { color: muted }]}>
          {dict.wealth.liquidity[account.liquidity ?? meta.defaultLiquidity]}
        </AppText>
      )}
    </View>
  );
}

function BankCard({
  account,
  hidden,
  onPress,
  index,
}: {
  account: FinancialAccount;
  hidden: boolean;
  onPress: () => void;
  index: number;
}) {
  const reduced = useFinanceStore(s => s.snapshot.settings.reducedMotion);
  const entrance = useCardEntrance(index, reduced);

  return (
    <Animated.View style={[{ marginBottom: 12 }, entrance]}>
      <BankPlasticCard account={account} hidden={hidden} onPress={onPress} />
    </Animated.View>
  );
}

function GoldCard({
  account,
  hidden,
  onPress,
  index,
}: {
  account: FinancialAccount;
  hidden: boolean;
  onPress: () => void;
  index: number;
}) {
  const dict = t();
  const reduced = useFinanceStore(s => s.snapshot.settings.reducedMotion);
  const entrance = useCardEntrance(index, reduced);
  const shine = useShine(reduced);
  const metric = secondaryMetric(account);

  return (
    <Animated.View style={[{ marginBottom: 12 }, entrance]}>
      <PressScale onPress={onPress}>
        <LinearGradient
          colors={['#2A210C', '#3D3010', '#1A1608']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 20,
            padding: 16,
            borderWidth: 1,
            borderColor: 'rgba(212,175,55,0.45)',
            overflow: 'hidden',
          }}>
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: -30,
                width: 48,
                height: 200,
                backgroundColor: 'rgba(255, 220, 120, 0.28)',
              },
              shine,
            ]}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <ValueBlock account={account} hidden={hidden} light />
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <AppText
                style={{
                  color: 'rgba(245, 215, 120, 0.7)',
                  fontSize: 11,
                  textAlign: 'right',
                }}>
                {dict.wealth.goldBar}
              </AppText>
              <AppText
                style={{
                  color: '#F8E7A8',
                  fontSize: 16,
                  fontFamily: 'Vazirmatn-SemiBold',
                  textAlign: 'right',
                  marginTop: 2,
                }}
                numberOfLines={1}>
                {account.name}
              </AppText>
              {metric ? (
                <AppText
                  style={{
                    color: 'rgba(248,231,168,0.7)',
                    fontSize: 12,
                    marginTop: 4,
                    textAlign: 'right',
                  }}
                  numberOfLines={1}>
                  {metric}
                </AppText>
              ) : null}
            </View>
            <LinearGradient
              colors={['#F5D76E', '#D4AF37', '#8B6914']}
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.35)',
              }}>
              <Coins size={24} color="#1A1406" strokeWidth={2.2} />
            </LinearGradient>
          </View>
        </LinearGradient>
      </PressScale>
    </Animated.View>
  );
}

function TypedAssetCard({
  account,
  hidden,
  onPress,
  index,
}: {
  account: FinancialAccount;
  hidden: boolean;
  onPress: () => void;
  index: number;
}) {
  const dict = t();
  const { colors } = useAppTheme();
  const reduced = useFinanceStore(s => s.snapshot.settings.reducedMotion);
  const entrance = useCardEntrance(index, reduced);
  const pulse = usePulse(reduced);
  const cls = resolveAssetClass(account);
  const meta = ASSET_CLASS_META[cls];
  const metric = secondaryMetric(account);

  const palette: Record<
    AssetClass,
    { bg: [string, string]; border: string; glyphBg: string }
  > = {
    cash: {
      bg: ['rgba(16,42,34,0.95)', 'rgba(10,28,24,0.95)'],
      border: 'rgba(52,211,153,0.35)',
      glyphBg: 'rgba(52,211,153,0.18)',
    },
    bank: {
      bg: ['rgba(12,36,40,0.95)', 'rgba(8,24,28,0.95)'],
      border: 'rgba(94,234,212,0.3)',
      glyphBg: 'rgba(94,234,212,0.16)',
    },
    gold: {
      bg: ['rgba(42,33,12,0.95)', 'rgba(26,22,8,0.95)'],
      border: 'rgba(212,175,55,0.4)',
      glyphBg: 'rgba(212,175,55,0.18)',
    },
    silver: {
      bg: ['rgba(28,34,42,0.95)', 'rgba(18,22,28,0.95)'],
      border: 'rgba(148,163,184,0.4)',
      glyphBg: 'rgba(148,163,184,0.18)',
    },
    currency: {
      bg: ['rgba(12,40,28,0.95)', 'rgba(8,26,18,0.95)'],
      border: 'rgba(74,222,128,0.35)',
      glyphBg: 'rgba(74,222,128,0.16)',
    },
    crypto: {
      bg: ['rgba(42,28,8,0.95)', 'rgba(28,18,6,0.95)'],
      border: 'rgba(245,158,11,0.4)',
      glyphBg: 'rgba(245,158,11,0.18)',
    },
    stock: {
      bg: ['rgba(12,28,48,0.95)', 'rgba(8,18,32,0.95)'],
      border: 'rgba(96,165,250,0.35)',
      glyphBg: 'rgba(96,165,250,0.16)',
    },
    fund: {
      bg: ['rgba(22,24,48,0.95)', 'rgba(14,16,34,0.95)'],
      border: 'rgba(129,140,248,0.35)',
      glyphBg: 'rgba(129,140,248,0.16)',
    },
    real_estate: {
      bg: ['rgba(40,24,12,0.95)', 'rgba(26,16,8,0.95)'],
      border: 'rgba(251,146,60,0.35)',
      glyphBg: 'rgba(251,146,60,0.16)',
    },
    vehicle: {
      bg: ['rgba(40,16,28,0.95)', 'rgba(26,10,18,0.95)'],
      border: 'rgba(244,114,182,0.35)',
      glyphBg: 'rgba(244,114,182,0.16)',
    },
    business: {
      bg: ['rgba(12,36,40,0.95)', 'rgba(8,24,28,0.95)'],
      border: 'rgba(45,212,191,0.35)',
      glyphBg: 'rgba(45,212,191,0.16)',
    },
    jewelry: {
      bg: ['rgba(40,16,36,0.95)', 'rgba(26,10,24,0.95)'],
      border: 'rgba(232,121,249,0.35)',
      glyphBg: 'rgba(232,121,249,0.16)',
    },
    collectible: {
      bg: ['rgba(32,24,48,0.95)', 'rgba(20,16,34,0.95)'],
      border: 'rgba(167,139,250,0.35)',
      glyphBg: 'rgba(167,139,250,0.16)',
    },
    other: {
      bg: ['rgba(28,32,36,0.95)', 'rgba(18,20,24,0.95)'],
      border: 'rgba(148,163,184,0.28)',
      glyphBg: 'rgba(148,163,184,0.14)',
    },
  };

  const look = palette[cls];
  const monogram =
    account.details?.class === 'crypto'
      ? account.details.symbol.slice(0, 3).toUpperCase()
      : account.details?.class === 'currency'
        ? account.details.currencyCode
        : account.details?.class === 'stock'
          ? account.details.symbol.slice(0, 4)
          : null;

  return (
    <Animated.View style={[{ marginBottom: 12 }, entrance]}>
      <PressScale onPress={onPress}>
        <LinearGradient
          colors={look.bg}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 18,
            paddingHorizontal: 14,
            paddingVertical: 14,
            borderWidth: 1,
            borderColor: look.border,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <ValueBlock account={account} hidden={hidden} />
            <View style={{ flex: 1, alignItems: 'flex-end', minWidth: 0 }}>
              <AppText
                style={{
                  fontSize: 15,
                  fontFamily: 'Vazirmatn-SemiBold',
                  color: colors.text,
                  textAlign: 'right',
                }}
                numberOfLines={1}>
                {account.name}
              </AppText>
              <AppText
                style={{
                  marginTop: 2,
                  fontSize: 11,
                  color: colors.textMuted,
                  textAlign: 'right',
                }}>
                {dict.wealth.classes[cls]}
              </AppText>
              {metric ? (
                <AppText
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    color: colors.text,
                    opacity: 0.78,
                    textAlign: 'right',
                  }}
                  numberOfLines={1}>
                  {metric}
                </AppText>
              ) : null}
            </View>
            <Animated.View
              style={[
                {
                  width: 48,
                  height: 48,
                  borderRadius: cls === 'crypto' ? 16 : 24,
                  backgroundColor: look.glyphBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: `${meta.accent}55`,
                },
                cls === 'crypto' || cls === 'currency' ? pulse : null,
              ]}>
              {monogram ? (
                <AppText
                  style={{
                    color: meta.accent,
                    fontSize: 12,
                    fontFamily: 'Vazirmatn-SemiBold',
                    writingDirection: 'ltr',
                  }}>
                  {monogram}
                </AppText>
              ) : (
                <ClassGlyph cls={cls} color={meta.accent} />
              )}
            </Animated.View>
          </View>
        </LinearGradient>
      </PressScale>
    </Animated.View>
  );
}

export function WealthHoldingCard({
  account,
  hidden,
  onPress,
  index = 0,
}: {
  account: FinancialAccount;
  hidden: boolean;
  onPress: () => void;
  index?: number;
}) {
  const cls = resolveAssetClass(account);
  if (cls === 'bank') {
    return <BankCard account={account} hidden={hidden} onPress={onPress} index={index} />;
  }
  if (cls === 'gold') {
    return <GoldCard account={account} hidden={hidden} onPress={onPress} index={index} />;
  }
  return <TypedAssetCard account={account} hidden={hidden} onPress={onPress} index={index} />;
}
