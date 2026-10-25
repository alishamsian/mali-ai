import React, { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { AppText } from '../../../components/ui/AppText';
import { Sparkline } from '../../../components/charts/Charts';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { t, interpolate } from '../../../i18n';
import { formatTomanFromRial } from '../../../utils/currency/money';
import { toPersianDigits } from '../../../utils/numbers/digits';
import { useFinanceStore } from '../../../store/finance/store';
import { EmptyState } from '../../../components/feedback/EmptyState';
import type { RootStackParamList } from '../../../app/navigation/types';
import { ASSET_CLASS_META, resolveAssetClass } from '../catalog/classes';
import { holdingPerformance } from '../engine/portfolio';

function Row({ k, v }: { k: string; v: string }) {
  const styles = useThemedStyles((colors, theme) => ({
    row: {
      flexDirection: 'row-reverse',
      justifyContent: 'space-between',
      paddingVertical: 7,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowK: { color: colors.textMuted, fontSize: 12 },
    rowV: {
      color: colors.text,
      fontSize: 13,
      fontFamily: theme.typography.fontFamily.semibold,
    },
  }));
  return (
    <View style={styles.row}>
      <AppText style={styles.rowK}>{k}</AppText>
      <AppText style={styles.rowV}>{v}</AppText>
    </View>
  );
}

export function AssetDetailScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'AssetDetail'>>();
  const { colors, mode } = useAppTheme();
  const isLight = mode === 'light';
  const panelBg = isLight ? colors.surfaceSolid : 'rgba(255,255,255,0.035)';
  const styles = useThemedStyles((colors, theme) => ({
    header: {
      flexDirection: 'row-reverse',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    hero: {
      borderRadius: 22,
      borderWidth: 1,
      padding: 20,
      alignItems: 'center',
      marginBottom: 14,
    },
    classTag: { fontSize: 12, color: colors.textMuted },
    title: {
      marginTop: 6,
      fontSize: 18,
      fontFamily: theme.typography.fontFamily.semibold,
      color: colors.text,
      textAlign: 'center',
    },
    value: {
      marginTop: 14,
      fontSize: 30,
      fontFamily: theme.typography.fontFamily.semibold,
      color: colors.text,
    },
    toman: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    priceSrc: { marginTop: 12, fontSize: 11, color: colors.textMuted },
    block: {
      borderRadius: 18,
      padding: 14,
      marginBottom: 12,
      backgroundColor: panelBg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    blockTitle: {
      textAlign: 'right',
      marginBottom: 10,
      fontFamily: theme.typography.fontFamily.semibold,
      color: colors.text,
    },
    notes: { textAlign: 'right', color: colors.text, lineHeight: 22 },
    delete: { alignItems: 'center', paddingVertical: 16 },
  }));
  const dict = t();
  const snapshot = useFinanceStore(s => s.snapshot);
  const deleteAccount = useFinanceStore(s => s.deleteAccount);
  const account = snapshot.accounts.find(a => a.id === route.params.id);
  const hidden = snapshot.settings.hideBalances;

  const content = useMemo(() => {
    if (!account) {
      return null;
    }
    const cls = resolveAssetClass(account);
    const meta = ASSET_CLASS_META[cls];
    const perf = holdingPerformance(account);
    const d = account.details;
    const history = (account.valueHistory ?? []).map(h => h.valueRial);
    const plUp = (perf.unrealizedPlPct ?? 0) >= 0;

    const typeRows: Array<{ k: string; v: string }> = [];
    if (d?.class === 'gold') {
      typeRows.push(
        { k: dict.wealth.fields.goldType, v: dict.wealth.goldTypes[d.goldType] },
        {
          k: dict.wealth.fields.weight,
          v: `${toPersianDigits(String(d.weight))} ${dict.wealth.goldUnits[d.unit]}`,
        },
        {
          k: dict.wealth.fields.purity,
          v: d.purity != null ? toPersianDigits(String(d.purity)) : '—',
        },
        {
          k: dict.wealth.fields.unitPrice,
          v: hidden ? '••••' : formatTomanFromRial(d.currentPricePerUnitRial),
        },
        {
          k: dict.wealth.fields.purchasePrice,
          v: hidden ? '••••' : formatTomanFromRial(d.purchasePriceRial),
        },
      );
    } else if (d?.class === 'silver') {
      typeRows.push(
        { k: dict.wealth.fields.silverType, v: dict.wealth.silverTypes[d.silverType] },
        {
          k: dict.wealth.fields.weight,
          v: `${toPersianDigits(String(d.weight))} ${dict.wealth.silverUnits[d.unit]}`,
        },
        { k: dict.wealth.fields.purity, v: toPersianDigits(String(d.purity)) },
        {
          k: dict.wealth.fields.spotPerGram,
          v: hidden ? '••••' : formatTomanFromRial(d.currentPricePerUnitRial),
        },
        {
          k: dict.wealth.fields.purchasePrice,
          v: hidden ? '••••' : formatTomanFromRial(d.purchasePriceRial),
        },
      );
    } else if (d?.class === 'currency') {
      typeRows.push(
        { k: dict.wealth.fields.fxAmount, v: `${toPersianDigits(String(d.amount))} ${d.currencyCode}` },
        {
          k: dict.wealth.fields.avgRate,
          v: hidden ? '••••' : formatTomanFromRial(d.averagePurchaseRateRial),
        },
        {
          k: dict.wealth.fields.currentRate,
          v: hidden ? '••••' : formatTomanFromRial(d.currentRateRial),
        },
      );
    } else if (d?.class === 'crypto') {
      typeRows.push(
        { k: dict.wealth.fields.quantity, v: `${toPersianDigits(String(d.quantity))} ${d.symbol}` },
        {
          k: dict.wealth.fields.avgBuy,
          v: hidden ? '••••' : formatTomanFromRial(d.averageBuyPriceRial),
        },
        {
          k: dict.wealth.fields.currentPrice,
          v: hidden ? '••••' : formatTomanFromRial(d.currentPriceRial),
        },
        { k: dict.wealth.fields.venue, v: d.venue ?? '—' },
        { k: dict.wealth.fields.network, v: d.network ?? '—' },
        { k: dict.wealth.fields.address, v: d.addressMasked ?? '—' },
      );
    } else if (d?.class === 'real_estate') {
      typeRows.push(
        { k: dict.wealth.fields.city, v: d.city },
        { k: dict.wealth.fields.area, v: `${toPersianDigits(String(d.areaSqm))} ${dict.wealth.sqm}` },
        {
          k: dict.wealth.fields.ownershipPct,
          v: `${toPersianDigits(String(d.ownershipPercent))}٪`,
        },
        {
          k: dict.wealth.fields.estimatedValue,
          v: hidden ? '••••' : formatTomanFromRial(d.estimatedValueRial),
        },
        {
          k: dict.wealth.fields.mortgage,
          v: hidden ? '••••' : formatTomanFromRial(d.mortgageRial ?? 0),
        },
        {
          k: dict.wealth.fields.monthlyRent,
          v: hidden ? '••••' : formatTomanFromRial(d.monthlyRentRial ?? 0),
        },
      );
    } else if (d?.class === 'vehicle') {
      typeRows.push(
        { k: dict.wealth.fields.brand, v: `${d.brand} ${d.model}` },
        { k: dict.wealth.fields.year, v: toPersianDigits(String(d.year)) },
        {
          k: dict.wealth.fields.purchasePrice,
          v: hidden ? '••••' : formatTomanFromRial(d.purchasePriceRial),
        },
        {
          k: dict.wealth.fields.estimatedValue,
          v: hidden ? '••••' : formatTomanFromRial(d.estimatedValueRial),
        },
      );
    } else if (d?.class === 'bank') {
      typeRows.push(
        { k: dict.wealth.fields.accountType, v: dict.wealth.bankTypes[d.accountType] },
        { k: dict.accounts.card, v: d.cardLast4 ? `•••• ${toPersianDigits(d.cardLast4)}` : '—' },
        { k: dict.wealth.fields.currency, v: d.currency },
      );
    } else if (d?.class === 'stock') {
      typeRows.push(
        { k: dict.wealth.fields.symbol, v: d.symbol },
        { k: dict.wealth.fields.company, v: d.company },
        { k: dict.wealth.fields.quantity, v: toPersianDigits(String(d.quantity)) },
      );
    } else if (d?.class === 'fund') {
      typeRows.push(
        { k: dict.wealth.fields.fundName, v: d.fundName },
        { k: dict.wealth.fields.units, v: toPersianDigits(String(d.units)) },
      );
    } else if (d?.class === 'business') {
      typeRows.push(
        {
          k: dict.wealth.fields.ownershipPct,
          v: `${toPersianDigits(String(d.ownershipPercent))}٪`,
        },
        {
          k: dict.wealth.fields.businessValue,
          v: hidden ? '••••' : formatTomanFromRial(d.estimatedBusinessValueRial),
        },
      );
    }

    return { cls, meta, perf, plUp, history, typeRows };
  }, [account, dict, hidden]);

  if (!account || !content) {
    return (
      <NightCanvas>
        <View style={{ paddingTop: insets.top + 24, paddingHorizontal: 20 }}>
          <EmptyState
            title={dict.wealth.notFound}
            subtitle={dict.wealth.notFoundHint}
            actionLabel={dict.common.back}
            onAction={() => nav.goBack()}
          />
        </View>
      </NightCanvas>
    );
  }

  const { cls, meta, perf, plUp, history, typeRows } = content;

  const linkedTxCount = snapshot.transactions.filter(tx => tx.accountId === account.id).length;

  const remove = () => {
    const body =
      linkedTxCount > 0
        ? interpolate(dict.wealth.deleteWithTx, { n: linkedTxCount })
        : dict.accounts.deleteBody;
    Alert.alert(dict.accounts.deleteTitle, body, [
      { text: dict.common.cancel, style: 'cancel' },
      {
        text: dict.transactions.delete,
        style: 'destructive',
        onPress: () => {
          deleteAccount(account.id);
          nav.goBack();
        },
      },
    ]);
  };

  return (
    <NightCanvas>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 48,
          paddingHorizontal: 16,
        }}>
        <View style={styles.header}>
          <Pressable onPress={() => nav.goBack()}>
            <AppText style={{ color: colors.textMuted }}>{dict.common.back}</AppText>
          </Pressable>
          <Pressable onPress={() => nav.navigate('AddWealthAsset', { id: account.id, assetClass: cls })}>
            <AppText style={{ color: colors.primary }}>{dict.accounts.edit}</AppText>
          </Pressable>
        </View>

        <View style={[styles.hero, { backgroundColor: meta.accentMuted, borderColor: `${meta.accent}44` }]}>
          <AppText style={styles.classTag}>{dict.wealth.classes[cls]}</AppText>
          <AppText style={styles.title}>{account.name}</AppText>
          <AppText style={styles.value}>
            {hidden ? '••••••••' : formatTomanFromRial(perf.netValueRial)}
          </AppText>
          <AppText style={styles.toman}>{dict.common.toman}</AppText>
          {perf.supportsPl && perf.unrealizedPlPct != null ? (
            <AppText style={{ color: plUp ? colors.income : colors.expense, marginTop: 10 }}>
              {plUp ? '+' : ''}
              {toPersianDigits(perf.unrealizedPlPct.toFixed(1))}٪ ·{' '}
              {hidden ? '••••' : formatTomanFromRial(perf.unrealizedPlRial)}
            </AppText>
          ) : null}
          <AppText style={styles.priceSrc}>
            {dict.wealth.lastUpdate}:{' '}
            {account.priceSource === 'provider'
              ? dict.wealth.sourceProvider
              : dict.wealth.sourceManual}
          </AppText>
        </View>

        {history.length >= 2 ? (
          <View style={styles.block}>
            <AppText style={styles.blockTitle}>{dict.wealth.history}</AppText>
            <Sparkline points={history} color={meta.accent} width={320} height={70} />
          </View>
        ) : null}

        <View style={styles.block}>
          <AppText style={styles.blockTitle}>{dict.wealth.performance}</AppText>
          <Row
            k={dict.wealth.currentValue}
            v={hidden ? '••••' : formatTomanFromRial(perf.currentValueRial)}
          />
          <Row
            k={dict.wealth.costBasis}
            v={hidden ? '••••' : formatTomanFromRial(perf.costBasisRial)}
          />
          {perf.liabilityRial > 0 ? (
            <Row
              k={dict.wealth.liability}
              v={hidden ? '••••' : formatTomanFromRial(perf.liabilityRial)}
            />
          ) : null}
          {perf.supportsPl ? (
            <Row
              k={dict.wealth.unrealizedPl}
              v={hidden ? '••••' : formatTomanFromRial(perf.unrealizedPlRial)}
            />
          ) : null}
          <Row
            k={dict.wealth.liquidityLabel}
            v={dict.wealth.liquidity[account.liquidity ?? meta.defaultLiquidity]}
          />
        </View>

        {typeRows.length > 0 ? (
          <View style={styles.block}>
            <AppText style={styles.blockTitle}>{dict.wealth.details}</AppText>
            {typeRows.map(r => (
              <Row key={r.k} k={r.k} v={r.v} />
            ))}
          </View>
        ) : null}

        {account.notes ? (
          <View style={styles.block}>
            <AppText style={styles.blockTitle}>{dict.wealth.fields.notes}</AppText>
            <AppText style={styles.notes}>{account.notes}</AppText>
          </View>
        ) : null}

        <Pressable style={styles.delete} onPress={remove}>
          <AppText style={{ color: colors.expense }}>{dict.transactions.delete}</AppText>
        </Pressable>
      </ScrollView>
    </NightCanvas>
  );
}
