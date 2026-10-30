import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DashboardScreen } from './DashboardScreen';
import { useFinanceStore } from '../../../store/finance/store';
import { emptySnapshot } from '../../../database/schema/snapshot';
import type { FinancialAccount } from '../../../types/finance';
import { fa } from '../../../i18n/fa';

const mockNavigation = { navigate: jest.fn() };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));
jest.mock('../../../components/lists/SwipeTxRow', () => ({
  SwipeTxRow: ({ children }: { children: React.ReactNode }) =>
    require('react').createElement(require('react-native').View, null, children),
}));

const state = () => useFinanceStore.getState();
const now = new Date().toISOString();
const account = (
  id: string,
  name: string,
  balance: number,
  rest: Partial<FinancialAccount> = {},
): FinancialAccount => ({
  id,
  name,
  userId: 'local-user',
  kind: 'bank',
  balanceRial: balance,
  transactionCount: 0,
  createdAt: now,
  updatedAt: now,
  ...rest,
});

beforeAll(async () => {
  await state().hydrate();
});
beforeEach(() => {
  jest.clearAllMocks();
  const data = emptySnapshot();
  data.settings.onboardingCompleted = true;
  data.settings.guestPreviewDismissed = true;
  data.accounts = [
    account('bank', 'بانک ملت', 124_500_000, { cardLast4: '1234' }),
    account('gold', 'طلای ۱۸ عیار', 1_100_000_000, {
      kind: 'asset',
      assetClass: 'gold',
      details: {
        class: 'gold',
        goldType: 'karat18',
        unit: 'gram',
        weight: 10,
        currentPricePerUnitRial: 110_000_000,
        purchasePriceRial: 900_000_000,
      },
    }),
    account('other-bank', 'بانک ملی', 124_000_000),
  ];
  useFinanceStore.setState({ snapshot: data, hydrated: true });
});
function showHome() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 393, height: 873 },
        insets: { top: 24, left: 0, right: 0, bottom: 24 },
      }}>
      <DashboardScreen navigation={mockNavigation as never} />
    </SafeAreaProvider>,
  );
}

test('all asset types open their own details and quick actions open the correct entry mode', () => {
  showHome();
  fireEvent.press(screen.getByTestId('home-asset-gold'));
  expect(mockNavigation.navigate).toHaveBeenLastCalledWith('AssetDetail', { id: 'gold' });
  // One add entry; voice and cheques/installments are the other shortcuts.
  fireEvent.press(screen.getByLabelText(fa.voiceEntry.a11yMic));
  expect(mockNavigation.navigate).toHaveBeenLastCalledWith('VoiceEntry');
  fireEvent.press(screen.getByLabelText(fa.obligations.title));
  expect(mockNavigation.navigate).toHaveBeenLastCalledWith('Obligations');
});

test('one privacy control masks the portfolio and every asset, including gold quantity', () => {
  showHome();
  expect(screen.getByText('۱۳۴,۸۵۰,۰۰۰')).toBeTruthy();
  expect(screen.getByText('۱۰ گرم')).toBeTruthy();
  act(() => {
    fireEvent.press(screen.getByLabelText(fa.home.hideAmounts));
  });
  expect(screen.queryByText('۱۳۴,۸۵۰,۰۰۰')).toBeNull();
  expect(screen.queryByText('۱۲,۴۵۰,۰۰۰')).toBeNull();
  expect(screen.queryByText('۱۱۰,۰۰۰,۰۰۰')).toBeNull();
  expect(screen.queryByText('۱۰ گرم')).toBeNull();
  expect(screen.getByLabelText(fa.home.showAmounts)).toBeTruthy();
});

test('an empty portfolio offers a real add-asset flow instead of sample balances', () => {
  useFinanceStore.setState({ snapshot: emptySnapshot() });
  showHome();
  fireEvent.press(screen.getByLabelText(fa.home.addAsset));
  expect(mockNavigation.navigate).toHaveBeenLastCalledWith('AddWealthAsset');
  expect(screen.queryByText('۱۳۴,۸۵۰,۰۰۰')).toBeNull();
});
