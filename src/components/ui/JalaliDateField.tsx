import React, { useState } from 'react';
import { View } from 'react-native';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { AppText } from './AppText';
import { BottomSheet } from './BottomSheet';
import { PressScale } from './PressScale';
import { useAppTheme } from '../../theme/ThemeBridge';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { toPersianDigits } from '../../utils/numbers/digits';
import {
  jalaliFullLabel,
  jalaliKey,
  jalaliMonthGrid,
  shiftJalaliDayKey,
  shiftJalaliMonth,
  todayJalaliKey,
} from '../../utils/dates/jalali';
import { t } from '../../i18n';

const WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

const parse = (key: string) => {
  const [year, month, day] = key.split('-').map(Number);
  return { year, month, day };
};

/**
 * A full Jalali date picker: a field showing the weekday and date, opening a month grid
 * (Saturday first, today marked, the right month length and leap years from the Jalali
 * calendar itself) with quick picks. Value and onChange use YYYY-MM-DD Jalali day keys.
 */
export function JalaliDateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (key: string) => void;
}) {
  const { colors } = useAppTheme();
  const dict = t().obligations;
  const [open, setOpen] = useState(false);
  const selected = parse(value);
  const [view, setView] = useState({ year: selected.year, month: selected.month });
  const today = todayJalaliKey();
  const grid = jalaliMonthGrid(view.year, view.month);
  const styles = useThemedStyles((c, th) => ({
    label: { textAlign: 'right', color: c.textSecondary, fontSize: 12.5, marginBottom: 6 },
    field: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 10,
      minHeight: 48,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.glassBorder,
      backgroundColor: c.glass,
    },
    value: {
      flex: 1,
      textAlign: 'right',
      color: c.text,
      fontFamily: th.typography.fontFamily.semibold,
    },
    nav: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    navBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    title: { color: c.text, fontSize: 16, fontFamily: th.typography.fontFamily.bold },
    week: { flexDirection: 'row-reverse' },
    weekDay: {
      width: `${100 / 7}%`,
      textAlign: 'center',
      color: c.textMuted,
      fontSize: 12,
      paddingVertical: 6,
    },
    cells: { flexDirection: 'row-reverse', flexWrap: 'wrap' },
    cell: { width: `${100 / 7}%`, height: 46, alignItems: 'center', justifyContent: 'center' },
    dayBox: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayText: { color: c.text, fontSize: 15 },
    quick: {
      flexDirection: 'row-reverse',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 12,
      marginBottom: 8,
    },
    chip: {
      paddingHorizontal: 14,
      minHeight: 38,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.glassStrong,
      borderWidth: 1,
      borderColor: c.glassBorder,
    },
    chipText: { color: c.text, fontSize: 13 },
  }));

  const openSheet = () => {
    setView({ year: selected.year, month: selected.month });
    setOpen(true);
  };
  const pick = (key: string) => {
    onChange(key);
    setOpen(false);
  };
  const quick = [
    [dict.today, today],
    [dict.tomorrow, shiftJalaliDayKey(today, 1)],
    [dict.plusWeek, shiftJalaliDayKey(today, 7)],
    [dict.plusMonth, shiftJalaliDayKey(today, 30)],
  ] as const;
  const cells: (number | null)[] = [
    ...Array.from({ length: grid.offset }, () => null),
    ...Array.from({ length: grid.days }, (_, i) => i + 1),
  ];

  return (
    <View>
      <AppText style={styles.label}>{label}</AppText>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={openSheet}
        style={styles.field}>
        <CalendarDays size={20} color={colors.textSecondary} />
        <AppText style={styles.value}>{jalaliFullLabel(value)}</AppText>
      </PressScale>
      <BottomSheet visible={open} title={label} onClose={() => setOpen(false)}>
        <View style={styles.nav}>
          <PressScale
            accessibilityLabel={dict.nextMonth}
            onPress={() => setView(v => shiftJalaliMonth(v.year, v.month, 1))}
            style={styles.navBtn}>
            <ChevronLeft size={22} color={colors.text} />
          </PressScale>
          <AppText style={styles.title}>{toPersianDigits(`${grid.name} ${view.year}`)}</AppText>
          <PressScale
            accessibilityLabel={dict.prevMonth}
            onPress={() => setView(v => shiftJalaliMonth(v.year, v.month, -1))}
            style={styles.navBtn}>
            <ChevronRight size={22} color={colors.text} />
          </PressScale>
        </View>
        <View style={styles.week}>
          {WEEKDAYS.map(d => (
            <AppText key={d} style={styles.weekDay}>
              {d}
            </AppText>
          ))}
        </View>
        <View style={styles.cells}>
          {cells.map((day, i) => {
            if (day == null) {
              return <View key={`e${i}`} style={styles.cell} />;
            }
            const key = jalaliKey(view.year, view.month, day);
            const isSelected = key === value;
            const isToday = key === today;
            return (
              <View key={key} style={styles.cell}>
                <PressScale
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => pick(key)}
                  style={[
                    styles.dayBox,
                    isSelected && { backgroundColor: colors.primary },
                    !isSelected && isToday && { borderWidth: 1.5, borderColor: colors.primary },
                  ]}>
                  <AppText style={[styles.dayText, isSelected && { color: colors.onPrimary }]}>
                    {toPersianDigits(day)}
                  </AppText>
                </PressScale>
              </View>
            );
          })}
        </View>
        <View style={styles.quick}>
          {quick.map(([name, key]) => (
            <PressScale
              key={name}
              accessibilityRole="button"
              onPress={() => pick(key)}
              style={styles.chip}>
              <AppText style={styles.chipText}>{name}</AppText>
            </PressScale>
          ))}
        </View>
      </BottomSheet>
    </View>
  );
}
