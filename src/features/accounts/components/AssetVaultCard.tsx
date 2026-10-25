import React from 'react';
import { StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Pencil } from 'lucide-react-native';
import { AppText } from '../../../components/ui/AppText';
import { PressScale } from '../../../components/ui/PressScale';
import { formatTomanFromRial } from '../../../utils/currency/money';
import { toPersianDigits } from '../../../utils/numbers/digits';
import { interpolate, t } from '../../../i18n';
import { theme } from '../../../theme';
import type { FinancialAccount } from '../../../types/finance';
import { getAssetCatalog } from '../catalog/assets';

function formatQty(qty: number | undefined, unitLabel: string): string {
  if (qty == null || !Number.isFinite(qty)) {
    return '—';
  }
  const rounded = Math.abs(qty - Math.round(qty)) < 1e-6 ? Math.round(qty) : Math.round(qty * 1000) / 1000;
  return `${toPersianDigits(String(rounded))} ${unitLabel}`;
}

export function AssetVaultCard({
  account,
  hidden,
  width,
  onPress,
}: {
  account: FinancialAccount;
  hidden: boolean;
  width?: number;
  onPress?: () => void;
}) {
  const dict = t();
  const catalog = getAssetCatalog(account.assetId) ?? getAssetCatalog('other')!;
  const { theme: cardTheme, symbol, mark } = catalog;
  const { ink, muted } = cardTheme;
  const unitLabel = dict.accounts.units[catalog.unitKey];
  const assetName =
    dict.accounts.assets[account.assetId ?? 'other'] ?? account.name;

  const body = (
    <LinearGradient
      colors={[...cardTheme.gradient]}
      locations={[0, 0.45, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}>
      <LinearGradient
        colors={[...cardTheme.sheen]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.orbA, { backgroundColor: cardTheme.glow }]} />
      <View style={styles.orbB} />
      <View style={styles.ring} />
      <View style={styles.facet} />

      <View style={styles.top}>
        <View style={styles.markBadge}>
          <AppText style={[styles.mark, { color: ink }]}>{mark}</AppText>
        </View>
        <View style={styles.topEnd}>
          <View style={[styles.symbolDisk, { borderColor: `${ink}33` }]}>
            <AppText style={[styles.symbol, { color: ink }]}>{symbol}</AppText>
          </View>
          {onPress ? (
            <View style={styles.editBadge}>
              <Pencil size={11} color={ink} strokeWidth={2.2} />
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.mid}>
        <AppText style={[styles.title, { color: ink }]} numberOfLines={1}>
          {account.name || assetName}
        </AppText>
        <AppText style={[styles.qty, { color: muted }]}>
          {hidden ? '••••' : formatQty(account.quantity, unitLabel)}
        </AppText>
      </View>

      <View style={styles.bottom}>
        <View style={styles.meta}>
          <AppText style={[styles.metaLabel, { color: muted }]}>
            {dict.accounts.unitPrice}
          </AppText>
          <AppText style={[styles.metaValue, { color: ink }]}>
            {hidden
              ? '••••'
              : account.unitPriceRial != null
                ? formatTomanFromRial(account.unitPriceRial)
                : '—'}
          </AppText>
        </View>
        <View style={styles.bal}>
          <AppText style={[styles.balLabel, { color: muted }]}>
            {dict.accounts.assetValue}
          </AppText>
          <AppText style={[styles.amount, { color: ink }]}>
            {hidden ? '••••••' : formatTomanFromRial(account.balanceRial)}
          </AppText>
        </View>
      </View>

      <AppText style={[styles.hint, { color: muted }]}>
        {interpolate(dict.accounts.vaultTag, { kind: assetName })}
      </AppText>
    </LinearGradient>
  );

  if (!onPress) {
    return <View style={[styles.shadow, width != null && { width }]}>{body}</View>;
  }

  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={dict.accounts.edit}
      onPress={onPress}
      style={[styles.shadow, width != null && { width }]}>
      {body}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: 22,
    shadowColor: '#000',
    shadowOpacity: 0.42,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  card: {
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    aspectRatio: 1.55,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.28)',
    direction: 'ltr' as const,
    justifyContent: 'space-between',
  },
  ring: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  facet: {
    position: 'absolute',
    top: -40,
    left: -20,
    width: 140,
    height: 90,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.08)',
    transform: [{ rotate: '-18deg' }],
  },
  orbA: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    top: -50,
    right: -40,
  },
  orbB: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.18)',
    bottom: -30,
    left: -20,
  },
  top: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topEnd: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  markBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  mark: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semibold,
    letterSpacing: 0.4,
  },
  symbolDisk: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.16)',
    borderWidth: 1,
  },
  symbol: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  editBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  mid: { marginTop: 10, alignItems: 'flex-end' },
  title: {
    fontSize: 17,
    fontFamily: theme.typography.fontFamily.semibold,
    textAlign: 'right',
  },
  qty: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    textAlign: 'right',
  },
  bottom: {
    marginTop: 10,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 10,
  },
  meta: { flex: 1, alignItems: 'flex-end' },
  metaLabel: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
  },
  metaValue: {
    marginTop: 2,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semibold,
    textAlign: 'right',
  },
  bal: { alignItems: 'flex-start' },
  balLabel: {
    fontSize: 10,
    marginBottom: 2,
    fontFamily: theme.typography.fontFamily.regular,
  },
  amount: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  hint: {
    marginTop: 8,
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    textAlign: 'left',
    opacity: 0.85,
  },
});
