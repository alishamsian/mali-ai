import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import type { RootStackParamList } from './types';
import { APP_FEATURES } from '../config/features';

type Nav = NavigationProp<ParamListBase> & {
  navigate<RouteName extends keyof RootStackParamList>(
    ...args: undefined extends RootStackParamList[RouteName]
      ? [screen: RouteName] | [screen: RouteName, params: RootStackParamList[RouteName]]
      : [screen: RouteName, params: RootStackParamList[RouteName]]
  ): void;
};

/** User-facing SMS hub — not the dev test lab. */
export function navigateSmsHub(navigation: Nav, smsEnabled: boolean) {
  navigation.navigate(smsEnabled ? 'SettingsBanksSms' : 'SmsSetup');
}

/** Dev-only parser / inject lab. */
export function navigateSmsTestLab(navigation: Nav) {
  if (APP_FEATURES.devTools) {
    navigation.navigate('SmsTest');
    return;
  }
  navigation.navigate('SettingsBanksSms');
}
