import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/** ناوبری مطمئن از تب به صفحات استک ریشه */
export function navigateRoot(
  navigation: NavigationProp<ParamListBase>,
  name: keyof RootStackParamList,
  params?: object,
): void {
  let nav: NavigationProp<ParamListBase> | undefined = navigation;
  let parent = navigation.getParent();
  while (parent) {
    nav = parent;
    parent = parent.getParent();
  }
  // @ts-expect-error dynamic root route
  nav?.navigate(name, params);
}
