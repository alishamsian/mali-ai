/* eslint-env jest */

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('react-native-linear-gradient', () => 'LinearGradient');

jest.mock('react-native-mmkv', () => {
  const store = new Map();
  return {
    MMKV: class {
      getString(key) {
        return store.get(key);
      }
      set(key, value) {
        store.set(key, String(value));
      }
      delete(key) {
        store.delete(key);
      }
      clearAll() {
        store.clear();
      }
    },
  };
});

jest.mock('react-native-keychain', () => ({
  setGenericPassword: jest.fn(async () => true),
  getGenericPassword: jest.fn(async () => false),
  resetGenericPassword: jest.fn(async () => true),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// FlashList ships untranspiled ESM and needs real layout to render rows; in tests a
// FlatList renders the same items synchronously.
jest.mock('@shopify/flash-list', () => {
  const { FlatList } = require('react-native');
  return { FlashList: FlatList };
});
