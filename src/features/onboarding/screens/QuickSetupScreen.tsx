import React, { useRef, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText } from '../../../components/ui/AppText';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { GlassPanel } from '../../../components/ui/GlassPanel';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { FilterChip } from '../../../components/ui/FilterChip';
import { t } from '../../../i18n';
import { useFinanceStore } from '../../../store/finance/store';
import { useAppTheme } from '../../../theme/ThemeBridge';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { toPersianDigits } from '../../../utils/numbers/digits';
import type { RootStackParamList } from '../../../app/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'QuickSetup'>;
type Unit = 'IRT' | 'IRR';
const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

/**
 * Three answers that make every number right from day one: what to call the user, the
 * day their money month starts (usually payday), and toman or rial. All optional.
 */
export function QuickSetupScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const dict = t().onboarding;
  const settings = useFinanceStore(s => s.snapshot.settings);
  const [name, setName] = useState(useFinanceStore.getState().snapshot.profile.displayName ?? '');
  const [startDay, setStartDay] = useState(settings.financialMonthStartDay ?? 1);
  const daysRef = useRef<ScrollView>(null);
  const [unit, setUnit] = useState<Unit>(settings.displayCurrency === 'IRR' ? 'IRR' : 'IRT');

  const save = () => {
    const store = useFinanceStore.getState();
    if (name.trim()) {
      store.updateProfile({ displayName: name.trim() });
    }
    store.updateSettings({ financialMonthStartDay: startDay, displayCurrency: unit });
    navigation.replace('SmsSetup');
  };

  const styles = useThemedStyles((c, th) => ({
    scroll: {
      flexGrow: 1,
      paddingTop: insets.top + 28,
      paddingBottom: insets.bottom + 20,
      paddingHorizontal: 24,
      gap: 14,
    },
    kicker: { textAlign: 'right', color: c.textMuted, fontSize: 12 },
    title: {
      textAlign: 'right',
      color: c.text,
      fontSize: 26,
      lineHeight: 40,
      fontFamily: th.typography.fontFamily.bold,
    },
    body: {
      textAlign: 'right',
      color: c.textSecondary,
      fontSize: 14,
      lineHeight: 24,
      marginBottom: 6,
    },
    card: { padding: 16, gap: 10 },
    label: {
      textAlign: 'right',
      color: c.text,
      fontSize: 14,
      fontFamily: th.typography.fontFamily.semibold,
    },
    hint: { textAlign: 'right', color: c.textMuted, fontSize: 12, lineHeight: 20 },
    input: {
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.glassBorder,
      backgroundColor: c.glass,
      color: c.text,
      paddingHorizontal: 14,
      fontFamily: th.typography.fontFamily.regular,
      fontSize: 15,
    },
    days: { flexDirection: 'row-reverse', gap: 8, paddingVertical: 2 },
    spacer: { flex: 1, minHeight: 12 },
  }));

  return (
    <NightCanvas>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.duration(360)}>
          <AppText style={styles.kicker}>{dict.setupKicker}</AppText>
          <AppText style={styles.title} accessibilityRole="header">
            {dict.setupTitle}
          </AppText>
          <AppText style={styles.body}>{dict.setupBody}</AppText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(360)}>
          <GlassPanel radius={24} style={styles.card}>
            <AppText style={styles.label}>{dict.nameLabel}</AppText>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={dict.namePlaceholder}
              placeholderTextColor={colors.textMuted}
              textAlign="right"
              returnKeyType="done"
              maxLength={40}
              style={styles.input}
            />
          </GlassPanel>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160).duration(360)}>
          <GlassPanel radius={24} style={styles.card}>
            <AppText style={styles.label}>{dict.monthStartLabel}</AppText>
            <AppText style={styles.hint}>{dict.monthStartHint}</AppText>
            <ScrollView
              horizontal
              ref={daysRef}
              // Days run right to left; open on day 1, which sits at the far end.
              onContentSizeChange={() => daysRef.current?.scrollToEnd({ animated: false })}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.days}>
              {DAYS.map(d => (
                <FilterChip
                  key={d}
                  label={toPersianDigits(d)}
                  active={d === startDay}
                  onPress={() => setStartDay(d)}
                />
              ))}
            </ScrollView>
          </GlassPanel>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(240).duration(360)}>
          <GlassPanel radius={24} style={styles.card}>
            <AppText style={styles.label}>{dict.unitLabel}</AppText>
            <SegmentedControl
              options={['IRT', 'IRR'] as Unit[]}
              value={unit}
              onChange={setUnit}
              labelFor={u => (u === 'IRT' ? dict.unitToman : dict.unitRial)}
            />
          </GlassPanel>
        </Animated.View>

        <View style={styles.spacer} />
        <PrimaryButton label={dict.continue} onPress={save} />
      </ScrollView>
    </NightCanvas>
  );
}
