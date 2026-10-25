import React, { useEffect } from 'react';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { APP_FEATURES } from '../config/features';
import type { RootStackParamList } from './types';
import { SmsTestScreen } from '../../features/sms/screens/SmsTestScreen';

/** Dev-only SMS lab — redirects regular users to the SMS settings hub. */
export function SmsTestGateScreen({
  navigation,
}: {
  navigation: NativeStackNavigationProp<RootStackParamList, 'SmsTest'>;
}) {
  useEffect(() => {
    if (!APP_FEATURES.devTools) {
      navigation.replace('SettingsBanksSms');
    }
  }, [navigation]);

  if (!APP_FEATURES.devTools) {
    return null;
  }

  return <SmsTestScreen navigation={navigation as never} />;
}
