import React from 'react';
import { Pressable, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarDays, Home, Landmark, PieChart, Plus } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { AppText } from '../../components/ui/AppText';
import { PressScale } from '../../components/ui/PressScale';
import { useAppTheme } from '../../theme/ThemeBridge';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { t } from '../../i18n';

type TabId = 'Home' | 'Daily' | 'Vault' | 'Analytics';

const TAB_META: Record<TabId, { label: () => string; Icon: LucideIcon }> = {
  Home: { label: () => t().nav.home, Icon: Home },
  Daily: { label: () => t().nav.daily, Icon: CalendarDays },
  Vault: { label: () => t().nav.vault, Icon: Landmark },
  Analytics: { label: () => t().nav.analytics, Icon: PieChart },
};

export function MainTabBar({
  state,
  navigation,
  onAdd,
}: BottomTabBarProps & { onAdd: () => void }) {
  const insets = useSafeAreaInsets();
  const dict = t();
  const { colors, mode } = useAppTheme();
  const styles = useThemedStyles((c, th) => ({
    shell: {
      position: 'absolute' as const,
      left: 20,
      right: 20,
    },
    bar: {
      flexDirection: 'row-reverse' as const,
      alignItems: 'center' as const,
      minHeight: 62,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: c.glassBorder,
      backgroundColor: mode === 'light' ? 'rgba(255,255,255,0.9)' : c.surfaceSolid,
      paddingHorizontal: 6,
      paddingVertical: 6,
      shadowColor: mode === 'light' ? '#28405A' : '#000',
      shadowOpacity: mode === 'light' ? 0.08 : 0.28,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: mode === 'light' ? 0 : 12,
    },
    tab: {
      flex: 1,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 3,
      minHeight: 50,
      borderRadius: 18,
      paddingHorizontal: 4,
    },
    tabOn: {},
    iconWrap: {
      width: 40,
      height: 32,
      borderRadius: 12,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    label: {
      fontSize: 10,
      fontFamily: th.typography.fontFamily.medium,
      textAlign: 'center' as const,
    },
    fabSlot: {
      width: 58,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      marginHorizontal: 2,
    },
    fab: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      marginTop: -10,
      shadowOpacity: 0.35,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
  }));

  const activeRoute = state.routes[state.index]?.name;

  const jump = (name: TabId) => {
    const index = state.routes.findIndex(r => r.name === name);
    if (index < 0) {
      return;
    }
    const event = navigation.emit({
      type: 'tabPress',
      target: state.routes[index].key,
      canPreventDefault: true,
    });
    if (!event.defaultPrevented && state.index !== index) {
      navigation.navigate(name);
    }
  };

  const renderTab = (name: TabId) => {
    const focused = activeRoute === name;
    const meta = TAB_META[name];
    const color = focused ? colors.text : colors.textMuted;
    return (
      <Pressable
        key={name}
        onPress={() => jump(name)}
        style={[styles.tab, focused && styles.tabOn]}
        accessibilityRole="button"
        accessibilityState={{ selected: focused }}>
        <View style={[styles.iconWrap, focused && { backgroundColor: colors.primary }]}>
          <meta.Icon color={focused ? colors.onPrimary : color} size={20} strokeWidth={focused ? 2.2 : 1.8} />
        </View>
        <AppText style={[styles.label, { color }]} numberOfLines={1}>
          {meta.label()}
        </AppText>
      </Pressable>
    );
  };

  return (
    <View style={[styles.shell, { bottom: Math.max(insets.bottom, 10) }]} pointerEvents="box-none">
      <View style={styles.bar}>
        {renderTab('Home')}
        {renderTab('Daily')}
        <View style={styles.fabSlot}>
          <PressScale
            accessibilityLabel={dict.a11y.addTransaction}
            onPress={onAdd}
            style={[styles.fab, { backgroundColor: colors.primary, shadowColor: colors.primary }]}>
            <Plus color={colors.onPrimary} size={24} strokeWidth={2.6} />
          </PressScale>
        </View>
        {renderTab('Vault')}
        {renderTab('Analytics')}
      </View>
    </View>
  );
}
