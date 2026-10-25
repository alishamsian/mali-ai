import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { navigateRoot } from './navigateRoot';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function AnalyticsRedirect() {
  const navigation = useNavigation<Nav>();
  useEffect(() => {
    navigateRoot(navigation, 'Main', { screen: 'Analytics', params: { section: 'overview' } });
  }, [navigation]);
  return <View />;
}

export function InsightsRedirect() {
  const navigation = useNavigation<Nav>();
  useEffect(() => {
    navigateRoot(navigation, 'Main', { screen: 'Analytics', params: { section: 'intel' } });
  }, [navigation]);
  return <View />;
}

export function RecapRedirect() {
  const navigation = useNavigation<Nav>();
  useEffect(() => {
    navigateRoot(navigation, 'Main', { screen: 'Analytics', params: { section: 'recap' } });
  }, [navigation]);
  return <View />;
}

export function CalendarRedirect() {
  const navigation = useNavigation<Nav>();
  useEffect(() => {
    navigateRoot(navigation, 'Main', { screen: 'Analytics', params: { section: 'calendar' } });
  }, [navigation]);
  return <View />;
}

export function GoalsRedirect() {
  const navigation = useNavigation<Nav>();
  useEffect(() => {
    navigateRoot(navigation, 'Budgets', { section: 'goals' });
  }, [navigation]);
  return <View />;
}

export function RecurringRedirect() {
  const navigation = useNavigation<Nav>();
  useEffect(() => {
    navigateRoot(navigation, 'Budgets', { section: 'bills' });
  }, [navigation]);
  return <View />;
}

export function AssistantRedirect() {
  return <InsightsRedirect />;
}

export function NotificationsRedirect() {
  const navigation = useNavigation<Nav>();
  useEffect(() => {
    navigateRoot(navigation, 'SettingsNotifications');
  }, [navigation]);
  return <View />;
}