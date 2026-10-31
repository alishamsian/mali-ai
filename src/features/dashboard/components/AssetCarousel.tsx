import React from 'react';
import { FlatList, Image, View, useWindowDimensions } from 'react-native';
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
    <Svg width={26} height={22} viewBox="0 0 52 44" accessible={false}>
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
  const styles = useThemedStyles((c, th) => ({
    button: { borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: c.glassBorder },
    card: {
      minHeight: 86,
      paddingHorizontal: 12,
      paddingVertical: 11,
      justifyContent: 'space-between',
    },
    top: { flexDirection: 'row-reverse', gap: 8, alignItems: 'center' },
    names: { flex: 1, minWidth: 0, alignItems: 'flex-end', gap: 1 },
    name: {
      fontSize: 13,
      fontFamily: th.typography.fontFamily.semibold,
      color: c.text,
      textAlign: 'right',
      alignSelf: 'stretch',
    },
    detail: { fontSize: 11, color: c.textSecondary, textAlign: 'right', alignSelf: 'stretch' },
    value: {
      fontSize: 17,
      lineHeight: 26,
      color: c.text,
      fontFamily: th.typography.fontFamily.bold,
    },
    unit: { fontSize: 11, color: c.textSecondary, textAlign: 'right' },
    logo: { width: 24, height: 24 },
    glyph: {
      width: 34,
      height: 34,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: p.quiet,
    },
    bottom: { marginTop: 8 },
    valueRow: { flexDirection: 'row-reverse', alignItems: 'baseline', gap: 4 },
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
                size={19}
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
  const { colors } = useAppTheme();
  const dict = t();
  // Two and a bit cards on screen, so the rail reads as scrollable without dots.
  const cardWidth = Math.min(176, Math.max(142, (width - 32 - GAP * 2) / 2.3));
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
    addTile: {
      width: 58,
      minHeight: 88,
      borderRadius: 18,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: c.glassBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
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
        <FlatList
          horizontal
          inverted
          data={accounts}
          keyExtractor={a => a.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
          ListFooterComponent={
            <PressScale
              onPress={onAdd}
              style={styles.addTile}
              accessibilityRole="button"
              accessibilityLabel={dict.home.addAsset}>
              <Plus size={20} color={colors.textSecondary} />
            </PressScale>
          }
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
