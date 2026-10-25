/**
 * @format
 */
// Must be first: crypto-js and our key/salt code read crypto.getRandomValues at load.
import 'react-native-get-random-values';
import 'react-native-gesture-handler';
import { AppRegistry, I18nManager } from 'react-native';
import App from './src/app/App';
import { name as appName } from './app.json';

/**
 * اپ با راست‌چین فیزیکی (textAlign:'right') طراحی شده.
 * forceRTL باعث می‌شود right/end برعکس شوند و متن‌ها بروند چپ.
 * پس RTL سیستمی را خاموش می‌کنیم و جابه‌جایی left/right را هم می‌بندیم.
 */
I18nManager.allowRTL(true);
I18nManager.swapLeftAndRightInRTL(false);
if (I18nManager.isRTL) {
  I18nManager.forceRTL(false);
}

AppRegistry.registerComponent(appName, () => App);
