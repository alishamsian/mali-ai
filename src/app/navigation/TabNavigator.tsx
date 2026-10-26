import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DashboardScreen } from '../../features/dashboard/screens/DashboardScreen';
import { DailyLedgerScreen } from '../../features/ledger/screens/DailyLedgerScreen';
import { VaultScreen } from '../../features/vault/screens/VaultScreen';
import { AnalyticsHubScreen } from '../../features/analytics/screens/AnalyticsHubScreen';
import { TransactionsScreen } from '../../features/transactions/screens/TransactionsScreen';
import { AddPlaceholderScreen } from '../../features/transactions/screens/AddPlaceholderScreen';
import { MainTabBar } from './MainTabBar';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const hiddenTab = { tabBarButton: () => null };

export function TabNavigator({ onAdd }: { onAdd: () => void }) {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      // Hidden tabs stay mounted; freezing them stops every store change from re-rendering
      // all five tab screens. They catch up when focused again.
      screenOptions={{ headerShown: false, freezeOnBlur: true }}
      tabBar={props => <MainTabBar {...props} onAdd={onAdd} />}>
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Daily" component={DailyLedgerScreen} />
      <Tab.Screen name="AddTab" component={AddPlaceholderScreen} />
      <Tab.Screen name="Vault" component={VaultScreen} />
      <Tab.Screen name="Analytics" component={AnalyticsHubScreen} />
      <Tab.Screen name="Transactions" options={hiddenTab}>
        {props => <TransactionsScreen {...props} embedded />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
