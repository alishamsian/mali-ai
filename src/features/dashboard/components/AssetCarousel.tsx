import React, { useRef, useState } from 'react';
import {
  FlatList,
  Image,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import {
  Bitcoin,
  Building2,
  Car,
  ChevronLeft,
  CircleDollarSign,
  Coins,
  Gem,
  Landmark,
  Package,
  PieChart,
  Plus,
  TrendingUp,
  Wallet,
} from 'lucide-react-native';
import { AppText } from '../../../components/ui/AppText';
import { MoneyText } from '../../../components/ui/MoneyText';
import { PressScale } from '../../../components/ui/PressScale';
import { resolveBankLogo } from '../../../components/banks/bankLogos';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { formatTomanFromRial, displayUnitLabel } from '../../../utils/currency/money';
import { toPersianDigits } from '../../../utils/numbers/digits';
import { toJalaliLabel } from '../../../utils/dates/jalali';
import { resolveAssetClass } from '../../wealth/catalog/classes';
import type { FinancialAccount } from '../../../types/finance';
import type { AssetClass } from '../../../types/wealth';
import { t } from '../../../i18n';
import { homePalette } from './homePalette';

const GAP = 10;
const ICONS: Partial<Record<AssetClass, typeof Landmark>> = {
  bank: Landmark,
  cash: Wallet,
  crypto: Bitcoin,
  currency: CircleDollarSign,
  stock: TrendingUp,
  fund: PieChart,
  real_estate: Building2,
  vehicle: Car,
  jewelry: Gem,
  collectible: Gem,
  business: Building2,
  silver: Coins,
};

function GoldBars() {
  return (
    <Svg width={46} height={42} viewBox="0 0 52 44" accessible={false}>
      <Defs>
        <SvgGradient id="homeGold" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFF3C3" />
          <Stop offset="1" stopColor="#C59A43" />
        </SvgGradient>
      </Defs>
      <Path
        d="M19 3h14l6 16H13z M8 23h14l6 17H2z M31 23h14l5 17H25z"
        fill="url(#homeGold)"
        stroke="#8A6B2F"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <Path
        d="m19 3 4 14h16 M8 23l4 15h15 M31 23l4 15h14"
        fill="none"
        stroke="#FFF4CC"
        strokeWidth={1.4}
      />
    </Svg>
  );
}

function accountDetail(account: FinancialAccount, hidden: boolean): string {
  const dict = t();
  const d = account.details;
  if (resolveAssetClass(account) === 'bank') {
    const last4 = account.cardLast4 ?? (d?.class === 'bank' ? d.cardLast4 : undefined);
    return last4 ? `•••• ${toPersianDigits(last4)}` : dict.home.bankAccount;
  }
  if (hidden) {
    return '•••';
  }
  if (!d) {
    return dict.wealth.classes[resolveAssetClass(account)];
  }
  const quantity = (n: number) => toPersianDigits(String(n)).replace('.', '٫');
  switch (d.class) {
    case 'gold':
      return `${quantity(d.weight)} ${dict.wealth.goldUnits[d.unit]}`;
    case 'silver':
      return `${quantity(d.weight)} ${dict.wealth.silverUnits[d.unit]}`;
    case 'currency':
      return `${quantity(d.amount)} ${d.currencyCode}`;
    case 'crypto':
      return `${quantity(d.quantity)} ${d.symbol}`;
    case 'stock':
      return `${quantity(d.quantity)} ${d.symbol}`;
    case 'fund':
      return `${quantity(d.units)} ${dict.wealth.units}`;
    case 'cash':
      return dict.wealth.classes.cash;
    case 'real_estate':
      return `${quantity(d.ownershipPercent)}٪ ${dict.wealth.ownership}`;
    default:
      return dict.wealth.classes[d.class];
  }
}

function AssetCard({
  account,
  hidden,
  width,
  onPress,
}: {
  account: FinancialAccount;
  hidden: boolean;
  width: number;
  onPress: () => void;
}) {
  const { colors, mode } = useAppTheme();
  const p = homePalette(mode);
  const cls = resolveAssetClass(account);
  const dict = t();
  const bankLogo = cls === 'bank' ? resolveBankLogo(account.bankId) : undefined;
  const Icon = ICONS[cls] ?? Package;
  const stamp = account.priceUpdatedAt ?? account.updatedAt;
  const isMarketAsset = cls !== 'bank' && cls !== 'cash';
  const styles = useThemedStyles((c, th) => ({
    button: { borderRadius: 19, overflow: 'hidden', borderWidth: 1, borderColor: c.glassBorder },
    card: { minHeight: 118, padding: 12, justifyContent: 'space-between' },
    top: { flexDirection: 'row-reverse', gap: 8, alignItems: 'flex-start' },
    names: { flex: 1, minWidth: 0, alignItems: 'flex-end', gap: 1 },
    name: {
      fontSize: 13,
      fontFamily: th.typography.fontFamily.semibold,
      color: c.text,
      textAlign: 'right',
      alignSelf: 'stretch',
    },
    detail: { fontSize: 10, color: c.textSecondary, textAlign: 'right', alignSelf: 'stretch' },
    value: {
      fontSize: 22,
      lineHeight: 33,
      color: c.text,
      fontFamily: th.typography.fontFamily.bold,
    },
    unit: { fontSize: 10, color: c.textSecondary, textAlign: 'right' },
    note: { fontSize: 9, color: c.textMuted, textAlign: 'right', marginTop: 5 },
    logo: { width: 26, height: 26 },
    glyph: { width: 32, height: 34, alignItems: 'center', justifyContent: 'center' },
    bottom: { marginTop: 9 },
    valueRow: { flexDirection: 'row-reverse', alignItems: 'baseline', gap: 4 },
    engraving: { position: 'absolute', left: -8, top: -12 },
  }));
  const gradient =
    cls === 'gold' || cls === 'jewelry' ? p.gold : cls === 'bank' ? p.bank : p.neutral;
  const detail = accountDetail(account, hidden);
  const value = hidden
    ? dict.home.amountHidden
    : `${formatTomanFromRial(account.balanceRial, {
        sign: account.balanceRial < 0,
      })} ${displayUnitLabel()}`;
  return (
    <PressScale
      onPress={onPress}
      style={[styles.button, { width }]}
      accessibilityRole="button"
      accessibilityLabel={`${account.name}، ${detail}، ${value}`}
      accessibilityHint={dict.home.assetDetailsHint}
      testID={`home-asset-${account.id}`}>
      <LinearGradient
        colors={gradient}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.card}>
        {cls === 'bank' ? (
          <Svg
            style={styles.engraving}
            width={130}
            height={95}
            pointerEvents="none"
            accessible={false}>
            {[0, 1, 2, 3, 4, 5].map(i => (
              <Path
                key={i}
                d={`M -15 ${8 + i * 11} Q 40 ${5 + i * 2} 130 ${80 + i * 8}`}
                stroke={p.engraving}
                fill="none"
                strokeWidth={1}
              />
            ))}
          </Svg>
        ) : null}
        <View style={styles.top}>
          <View style={styles.names}>
            <AppText style={styles.name} numberOfLines={1}>
              {account.name}
            </AppText>
            <AppText style={styles.detail} numberOfLines={1}>
              {detail}
            </AppText>
          </View>
          <View style={styles.glyph}>
            {cls === 'gold' ? (
              <GoldBars />
            ) : bankLogo ? (
              <Image source={bankLogo} style={styles.logo} resizeMode="contain" />
            ) : (
              <Icon
                size={25}
                strokeWidth={1.6}
                color={cls === 'jewelry' ? p.goldInk : colors.textSecondary}
              />
            )}
          </View>
        </View>
        <View style={styles.bottom}>
          <View style={styles.valueRow}>
            <MoneyText style={styles.value} align="right" minFontScale={0.65}>
              {hidden
                ? '••••••'
                : formatTomanFromRial(account.balanceRial, { sign: account.balanceRial < 0 })}
            </MoneyText>
            <AppText style={styles.unit}>{displayUnitLabel()}</AppText>
          </View>
          {isMarketAsset ? (
            <AppText style={styles.note} numberOfLines={1}>
              {account.priceSource === 'provider' ? dict.home.marketValue : dict.home.recordedValue}
              {stamp && !Number.isNaN(Date.parse(stamp)) ? ` · ${toJalaliLabel(stamp)}` : ''}
            </AppText>
          ) : null}
        </View>
      </LinearGradient>
    </PressScale>
  );
}

export function AssetCarousel({
  accounts,
  hidden,
  onOpen,
  onAll,
  onAdd,
}: {
  accounts: FinancialAccount[];
  hidden: boolean;
  onOpen: (id: string) => void;
  onAll: () => void;
  onAdd: () => void;
}) {
  const { width } = useWindowDimensions();
  const { colors, mode } = useAppTheme();
  const dict = t();
  const ref = useRef<FlatList<FinancialAccount>>(null);
  const [position, setPosition] = useState(0);
  const cardWidth =
    accounts.length === 1
      ? Math.min(width - 40, 360)
      : Math.min(228, Math.max(164, (width - 52) / 2));
  const visible = Math.max(1, Math.floor((width - 40 + GAP) / (cardWidth + GAP)));
  const pages = Math.max(1, accounts.length - visible + 1);
  const active = Math.min(position, pages - 1);
  const p = homePalette(mode);
  const styles = useThemedStyles((c, th) => ({
    root: { gap: 10 },
    heading: {
      flexDirection: 'row-reverse',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
    },
    title: { color: c.text, fontSize: 16, fontFamily: th.typography.fontFamily.bold },
    all: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 3,
      minHeight: 44,
      paddingLeft: 3,
    },
    allText: { color: c.textSecondary, fontSize: 12 },
    rail: { paddingHorizontal: 16, gap: GAP },
    dots: {
      flexDirection: 'row-reverse',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 5,
      height: 10,
    },
    dot: { height: 4, width: 4, borderRadius: 2, backgroundColor: p.track },
    selected: { width: 12, backgroundColor: c.income },
    empty: {
      marginHorizontal: 16,
      padding: 17,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.glassBorder,
      backgroundColor: c.glass,
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 12,
    },
    emptyText: { flex: 1, gap: 3 },
    emptyTitle: { color: c.text, fontSize: 13, fontFamily: th.typography.fontFamily.semibold },
    emptySub: { color: c.textMuted, fontSize: 11, lineHeight: 18 },
    add: {
      width: 42,
      height: 42,
      borderRadius: 15,
      backgroundColor: c.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
  }));
  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPosition(Math.max(0, Math.round(event.nativeEvent.contentOffset.x / (cardWidth + GAP))));
  };
  return (
    <View style={styles.root}>
      <View style={styles.heading}>
        <AppText style={styles.title}>{dict.home.assetWallet}</AppText>
        <PressScale
          onPress={onAll}
          style={styles.all}
          accessibilityRole="button"
          accessibilityLabel={dict.home.viewAllAssets}>
          <AppText style={styles.allText}>{dict.dashboard.seeAll}</AppText>
          <ChevronLeft size={15} color={colors.textSecondary} />
        </PressScale>
      </View>
      {accounts.length ? (
        <>
          <FlatList
            ref={ref}
            horizontal
            inverted
            data={accounts}
            keyExtractor={a => a.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
            snapToInterval={cardWidth + GAP}
            decelerationRate="fast"
            disableIntervalMomentum
            onMomentumScrollEnd={onScrollEnd}
            onScrollEndDrag={onScrollEnd}
            renderItem={({ item }) => (
              <AssetCard
                account={item}
                width={cardWidth}
                hidden={hidden}
                onPress={() => onOpen(item.id)}
              />
            )}
            accessibilityLabel={dict.home.assetRailHint}
            initialNumToRender={4}
            windowSize={3}
          />
          {pages > 1 ? (
            <View
              style={styles.dots}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants">
              {Array.from({ length: Math.min(pages, 7) }, (_, i) => (
                <View key={i} style={[styles.dot, i === Math.min(active, 6) && styles.selected]} />
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <PressScale
          onPress={onAdd}
          style={styles.empty}
          accessibilityRole="button"
          accessibilityLabel={dict.home.addAsset}>
          <View style={styles.emptyText}>
            <AppText style={styles.emptyTitle}>{dict.home.addAsset}</AppText>
            <AppText style={styles.emptySub}>{dict.home.emptyAssets}</AppText>
          </View>
          <View style={styles.add}>
            <Plus size={21} color={colors.onPrimary} />
          </View>
        </PressScale>
      )}
    </View>
  );
}
