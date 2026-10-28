import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CalendarClock } from 'lucide-react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppText } from '../../../components/ui/AppText';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { PressScale } from '../../../components/ui/PressScale';
import { t, interpolate } from '../../../i18n';
import { useFinanceStore } from '../../../store/finance/store';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { formatTomanFromRial } from '../../../utils/currency/money';
import { toPersianDigits } from '../../../utils/numbers/digits';
import { upcomingDues } from '../../../engine/obligations/dues';
import { daysLeftLabel } from '../format';
import type { RootStackParamList } from '../../../app/navigation/types';

const HOME_HORIZON_DAYS = 30;

/** Home: what is due in the next 30 days. Renders nothing when there is nothing due. */
export function DuesSummaryCard({ hidden }: { hidden: boolean }) {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useAppTheme();
  const dict = t().obligations;
  const plans = useFinanceStore(s => s.snapshot.installmentPlans);
  const cheques = useFinanceStore(s => s.snapshot.cheques);
  const debts = useFinanceStore(s => s.snapshot.debts);
  const calendar = useFinanceStore(s => s.snapshot.settings.calendar) ?? 'jalali';
  const dues = useMemo(
    () => upcomingDues({ plans, cheques, debts }, new Date(), HOME_HORIZON_DAYS, calendar),
    [plans, cheques, debts, calendar],
  );
  const styles = useThemedStyles((c, th) => ({
    row: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, padding: 14 },
    icon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.highlight,
    },
    text: { flex: 1, gap: 2 },
    title: { textAlign: 'right', fontFamily: th.typography.fontFamily.semibold, color: c.text },
    sub: { textAlign: 'right', color: c.textMuted, fontSize: 12 },
    late: { color: c.warning },
    amount: { fontFamily: th.typography.fontFamily.semibold, color: c.text },
  }));

  if (dues.length === 0) {
    return null;
  }
  const outRial = dues.filter(d => d.flow === 'out').reduce((s, d) => s + d.amountRial, 0);
  const overdue = dues.filter(d => d.overdue).length;
  const first = dues[0];
  return (
    <PressScale accessibilityRole="button" onPress={() => nav.navigate('Obligations')}>
      <GlassPanel radius={24} style={styles.row}>
        <View style={styles.icon}>
          <CalendarClock size={20} color={colors.onHighlight} />
        </View>
        <View style={styles.text}>
          <AppText style={styles.title}>{dict.homeTitle}</AppText>
          <AppText style={[styles.sub, overdue > 0 && styles.late]} numberOfLines={1}>
            {overdue > 0
              ? interpolate(dict.homeOverdue, { n: toPersianDigits(overdue) })
              : interpolate(dict.homeNext, { title: first.title, when: daysLeftLabel(first.daysLeft) })}
          </AppText>
        </View>
        <AppText style={styles.amount}>
          {hidden ? '••••' : `${formatTomanFromRial(outRial)} ${t().common.toman}`}
        </AppText>
      </GlassPanel>
    </PressScale>
  );
}
