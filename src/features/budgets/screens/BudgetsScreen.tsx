import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { NightCanvas } from '../../../components/ui/NightCanvas';
import { BudgetsPanel } from '../components/BudgetsPanel';
import { GoalsScreen } from '../../goals/screens/GoalsScreen';
import { RecurringScreen } from '../../insights/screens/RecurringScreen';
import type { RootStackParamList } from '../../../app/navigation/types';
import { t } from '../../../i18n';

const SECTIONS = ['budgets', 'goals', 'bills'] as const;
type Section = (typeof SECTIONS)[number];

export function BudgetsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Budgets'>>();
  const dict = t();
  const [section, setSection] = useState<Section>(route.params?.section ?? 'budgets');

  useEffect(() => {
    if (route.params?.section) {
      setSection(route.params.section);
    }
  }, [route.params?.section]);

  return (
    <NightCanvas>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: 48,
        }}
        showsVerticalScrollIndicator={false}>
        <ScreenHeader title={dict.budgets.hubTitle} onBack={() => navigation.goBack()} />
        <View style={{ marginVertical: 12 }}>
          <SegmentedControl
            options={[...SECTIONS]}
            value={section}
            onChange={setSection}
            labelFor={s =>
              s === 'budgets'
                ? dict.budgets.title
                : s === 'goals'
                ? dict.goals.title
                : dict.bills.title
            }
          />
        </View>
        {section === 'budgets' ? <BudgetsPanel /> : null}
        {section === 'goals' ? <GoalsScreen embedded /> : null}
        {section === 'bills' ? <RecurringScreen embedded /> : null}
      </ScrollView>
    </NightCanvas>
  );
}
