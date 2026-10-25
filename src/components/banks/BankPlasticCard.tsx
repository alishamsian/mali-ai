import React from 'react';
import { StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Pencil } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { AppText } from '../ui/AppText';
import { PressScale } from '../ui/PressScale';
import { BankEmblem } from './BankEmblem';
import { bankCardTheme } from '../../theme/accents';
import { formatTomanFromRial } from '../../utils/currency/money';
import { toPersianDigits } from '../../utils/numbers/digits';
import { interpolate, t } from '../../i18n';
import { theme } from '../../theme';
import type { FinancialAccount } from '../../types/finance';

function pan(last4?: string): string {
  if (!last4) {
    return '';
  }
  const digits = toPersianDigits(last4.padStart(4, '0').slice(-4));
  return `••••  ••••  ••••  ${digits}`;
}

function Contactless({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M8.5 8.5c2 2 2 5 0 7" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      <Path d="M11.5 6c3.2 3.2 3.2 8.8 0 12" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
      <Path d="M14.5 3.8c4.4 4.2 4.4 12.2 0 16.4" stroke={color} strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

export function BankPlasticCard({
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
  const bankId = account.bankId ?? (account.kind === 'cash' || account.kind === 'wallet' ? 'cash' : undefined);
  const cardTheme = bankCardTheme(bankId);
  const isCash = account.kind === 'cash' || account.kind === 'wallet' || bankId === 'cash';
  const { ink, muted } = cardTheme;
  const isPasargad = bankId === 'pasargad';

  const body = (
    <LinearGradient
      colors={[...cardTheme.gradient]}
      locations={[0, 0.42, 1]}
      start={{ x: 0.05, y: 0 }}
      end={{ x: 0.95, y: 1 }}
      style={styles.card}>
      <LinearGradient
        colors={[...cardTheme.sheen]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.glowA, { backgroundColor: cardTheme.glow }]} />
      <View style={styles.glowB} />
      <View style={styles.rim} />
      {isPasargad ? <View style={styles.goldStrip} /> : null}

      <View style={styles.top}>
        <BankEmblem bankId={bankId} size={40} />
        <View style={styles.topEnd}>
          {isCash ? null : <Contactless color={muted} />}
          {onPress ? (
            <View style={styles.editBadge}>
              <Pencil size={11} color={ink} strokeWidth={2.2} />
            </View>
          ) : null}
        </View>
      </View>

      {!isCash ? (
        <LinearGradient
          colors={isPasargad ? ['#F0D78A', '#C9A227', '#8B6914'] : ['#F6E7B8', '#D4AF37', '#A68620']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.chip}>
          <View style={styles.chipGrid}>
            <View style={styles.chipCell} />
            <View style={styles.chipCell} />
            <View style={styles.chipCell} />
            <View style={styles.chipCell} />
          </View>
        </LinearGradient>
      ) : (
        <View style={styles.chipGhost} />
      )}

      <AppText style={[styles.pan, { color: ink }]}>
        {isCash ? dict.accounts.cash : account.cardLast4 ? pan(account.cardLast4) : dict.accounts.card}
      </AppText>

      <View style={styles.bottom}>
        <View style={styles.meta}>
          <AppText style={[styles.bankName, { color: ink }]} numberOfLines={1}>
            {account.name}
          </AppText>
          <AppText style={[styles.txCount, { color: muted }]}>
            {interpolate(dict.accounts.txCount, { count: account.transactionCount })}
          </AppText>
        </View>
        <View style={styles.bal}>
          <AppText style={[styles.balLabel, { color: muted }]}>{dict.accounts.total}</AppText>
          <AppText style={[styles.amount, { color: ink }]}>
            {hidden ? '••••••' : formatTomanFromRial(account.balanceRial)}
          </AppText>
        </View>
      </View>
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
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  card: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
    aspectRatio: 1.586,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    direction: 'ltr' as const,
    justifyContent: 'space-between',
  },
  rim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  glowA: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    top: -56,
    right: -36,
  },
  glowB: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(0,0,0,0.2)',
    bottom: -36,
    left: -24,
  },
  goldStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(232,180,90,0.9)',
  },
  top: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topEnd: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
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
  chip: {
    width: 42,
    height: 30,
    borderRadius: 6,
    marginTop: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(120,90,20,0.4)',
    alignSelf: 'flex-start',
  },
  chipGhost: { height: 30, marginTop: 14 },
  chipGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  chipCell: {
    width: '50%',
    height: '50%',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(90,70,20,0.35)',
  },
  pan: {
    marginTop: 14,
    fontSize: 17,
    letterSpacing: 1.6,
    fontFamily: theme.typography.fontFamily.semibold,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  bottom: {
    marginTop: 12,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
  },
  meta: { flex: 1, alignItems: 'flex-end' },
  bankName: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semibold,
    textAlign: 'right',
  },
  txCount: {
    fontSize: 11,
    marginTop: 2,
    textAlign: 'right',
    fontFamily: theme.typography.fontFamily.regular,
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
});
