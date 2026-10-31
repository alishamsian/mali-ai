import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { AppState, RefreshControl, Share } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DailyLedgerScreen } from './DailyLedgerScreen';
import { useFinanceStore } from '../../../store/finance/store';
import { emptySnapshot } from '../../../database/schema/snapshot';
import { fa } from '../../../i18n/fa';
import { appAlert, appToast } from '../../../components/ui/AppAlert';
import type { Transaction } from '../../../types/finance';

jest.mock('jalaliday', () =>
  jest.requireActual('../../../../node_modules/jalaliday/src/dayjs/plugin.ts'),
);
const mockNavigation = { navigate: jest.fn() };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
}));
jest.mock('../../../components/lists/SwipeTxRow', () => ({
  SwipeTxRow: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../../../components/ui/AppAlert', () => ({ appAlert: jest.fn(), appToast: jest.fn() }));
const date = '2026-10-31T10:00:00+03:30';
const key = '1405-08-09';
const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: 'spend',
  userId: 'local-user',
  accountId: 'cash',
  type: 'purchase',
  direction: 'out',
  amountRial: 1000000,
  currency: 'IRR',
  categoryId: 'food',
  merchant: 'خرید روز',
  transactionDate: date,
  source: 'manual',
  fingerprint: 'test',
  confidence: 1,
  isConfirmed: true,
  needsReview: false,
  createdAt: date,
  updatedAt: date,
  ...over,
});
beforeAll(async () => {
  await useFinanceStore.getState().hydrate();
});
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-31T16:00:00+03:30'));
  const s = emptySnapshot();
  s.settings.reducedMotion = true;
  s.settings.onboardingCompleted = true;
  s.settings.guestPreviewDismissed = true;
  s.transactions = [
    tx(),
    tx({ id: 'yesterday', amountRial: 700000, transactionDate: '2026-10-30T10:00:00+03:30' }),
  ];
  useFinanceStore.setState({ snapshot: s, hydrated: true });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});
function show() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 393, height: 873 },
        insets: { top: 24, left: 0, right: 0, bottom: 24 },
      }}>
      <DailyLedgerScreen />
    </SafeAreaProvider>,
  );
}
function patchSnapshot(update: (s: ReturnType<typeof emptySnapshot>) => void) {
  const s = { ...useFinanceStore.getState().snapshot };
  update(s);
  useFinanceStore.setState({ snapshot: s });
}

test('one entry opens the selected day; arrows have distinct labels and do not skip months', () => {
  show();
  fireEvent.press(screen.getByLabelText(fa.daily.nextDay));
  expect(screen.getByText('۱۰ آبان ۱۴۰۵')).toBeTruthy();
  expect(screen.queryByText('۱۰ آذر ۱۴۰۵')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: fa.daily.addTransaction }));
  expect(mockNavigation.navigate).toHaveBeenLastCalledWith('AddTransaction', {
    mode: 'expense',
    dayKey: '1405-08-10',
  });
  fireEvent.press(screen.getByLabelText(fa.daily.previousDay));
  expect(screen.getByTestId(`daily-day-${key}`).props.accessibilityState.selected).toBe(true);
});
test('calendar and details open the correct destinations', () => {
  show();
  fireEvent.press(screen.getByLabelText(fa.daily.viewCalendar));
  expect(mockNavigation.navigate).toHaveBeenLastCalledWith('Analytics', {
    section: 'calendar',
    calendarDayKey: key,
  });
  fireEvent.press(screen.getByText('خرید روز'));
  expect(mockNavigation.navigate).toHaveBeenLastCalledWith('TransactionDetails', { id: 'spend' });
});
test('privacy masks monetary text, category bars, trend and outgoing share payload', async () => {
  const spy = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.dismissedAction });
  show();
  expect(screen.getByTestId('daily-spend-trend')).toBeTruthy();
  fireEvent.press(screen.getByLabelText(fa.home.hideAmounts));
  expect(screen.queryByTestId('daily-spend-trend')).toBeNull();
  expect(screen.queryByText(/۹۰,۰۰۰/)).toBeNull();
  expect(screen.queryByText(/۱۰۰,۰۰۰/)).toBeNull();
  await act(async () => {
    fireEvent.press(screen.getByLabelText(fa.daily.share));
  });
  expect(spy.mock.calls[0][0].message).not.toMatch(/۱۰۰,۰۰۰|۹۰,۰۰۰|تومان|ریال|−/);
  expect(screen.getByLabelText(fa.home.showAmounts)).toBeTruthy();
});
test('expense breakdown excludes income and responds to the SMS filter', () => {
  patchSnapshot(s => {
    s.transactions = [
      tx(),
      tx({
        id: 'salary',
        merchant: 'حقوق',
        direction: 'in',
        type: 'deposit',
        categoryId: 'income',
        amountRial: 5000000,
      }),
      tx({ id: 'sms', source: 'android_sms', amountRial: 300000, categoryId: 'shopping' }),
    ];
  });
  show();
  const categories = within(screen.getByTestId('daily-expense-categories'));
  expect(categories.queryByText(fa.categories.income)).toBeNull();
  expect(categories.getByText(fa.categories.food)).toBeTruthy();
  fireEvent.press(screen.getByRole('tab', { name: fa.daily.sms }));
  expect(
    within(screen.getByTestId('daily-expense-categories')).queryByText(fa.categories.food),
  ).toBeNull();
  fireEvent.press(screen.getByText(fa.daily.clearFilters));
  expect(screen.getByText('۳ تراکنش')).toBeTruthy();
});
test('refunds remain in the expense filter, not the income filter', () => {
  patchSnapshot(s => {
    s.transactions = [
      tx({
        id: 'refund',
        merchant: 'برگشت سفارش',
        type: 'refund',
        direction: 'in',
        amountRial: 200000,
      }),
    ];
  });
  show();
  fireEvent.press(screen.getByRole('tab', { name: fa.daily.expense }));
  expect(screen.getByText('برگشت سفارش')).toBeTruthy();
  fireEvent.press(screen.getByRole('tab', { name: fa.daily.income }));
  expect(screen.queryByText('برگشت سفارش')).toBeNull();
  expect(screen.getByText(fa.daily.filterEmpty)).toBeTruthy();
});
test('budget exactly reached is different from over budget, and hidden mode reveals neither state', () => {
  patchSnapshot(s => {
    s.budgets = [
      {
        id: 'b',
        userId: 'u',
        period: 'monthly',
        year: 2026,
        totalLimitRial: 1700000,
        createdAt: date,
      },
    ];
  });
  show();
  expect(screen.getByText(fa.daily.budgetReached)).toBeTruthy();
  expect(screen.queryByText(fa.daily.budgetOver)).toBeNull();
  act(() =>
    patchSnapshot(s => {
      s.transactions = [...s.transactions, tx({ id: 'extra', amountRial: 10 })];
    }),
  );
  expect(screen.getByText(fa.daily.budgetOver)).toBeTruthy();
  fireEvent.press(screen.getByLabelText(fa.home.hideAmounts));
  expect(screen.queryByText(fa.daily.budgetOver)).toBeNull();
  expect(screen.getByText(fa.daily.budgetHidden)).toBeTruthy();
});
test('today follows midnight without a transaction/store update', () => {
  jest.setSystemTime(new Date('2026-10-31T23:59:59.900+03:30'));
  show();
  act(() => {
    jest.advanceTimersByTime(200);
  });
  expect(screen.getByText('۱۰ آبان ۱۴۰۵')).toBeTruthy();
  expect(screen.getByTestId('daily-day-1405-08-10').props.accessibilityState.selected).toBe(true);
});
test('a historical selection survives midnight and returning to today follows the clock', () => {
  jest.setSystemTime(new Date('2026-10-31T23:59:59.900+03:30'));
  show();
  fireEvent.press(screen.getByLabelText(fa.daily.previousDay));
  act(() => {
    jest.advanceTimersByTime(200);
  });
  expect(screen.getByText('۸ آبان ۱۴۰۵')).toBeTruthy();
  fireEvent.press(screen.getByLabelText(`۸ آبان ۱۴۰۵، ${fa.daily.tapToday}`));
  expect(screen.getByText('۱۰ آبان ۱۴۰۵')).toBeTruthy();
});
test('foreground resume refreshes today after the clock changes', () => {
  const listener = jest.spyOn(AppState, 'addEventListener');
  show();
  jest.setSystemTime(new Date('2026-11-01T10:00:00+03:30'));
  act(() => {
    listener.mock.calls[0][1]('active');
  });
  expect(screen.getByText('۱۰ آبان ۱۴۰۵')).toBeTruthy();
});
test('share failures are handled with a readable message', async () => {
  jest.spyOn(Share, 'share').mockRejectedValue(new Error('native share failed'));
  show();
  await act(async () => {
    fireEvent.press(screen.getByLabelText(fa.daily.share));
  });
  expect(appToast).toHaveBeenCalledWith(fa.daily.shareError);
});
test('all sort options work through the action sheet', () => {
  show();
  fireEvent.press(screen.getByLabelText(`${fa.daily.sortBy}: ${fa.daily.time_desc}`));
  const buttons = jest.mocked(appAlert).mock.calls[0][2]!;
  expect(buttons.map(b => b.text)).toEqual([
    fa.daily.time_desc,
    fa.daily.time_asc,
    fa.daily.amount_desc,
    fa.daily.amount_asc,
    fa.common.cancel,
  ]);
  act(() => {
    buttons[2].onPress?.();
  });
  expect(screen.getByLabelText(`${fa.daily.sortBy}: ${fa.daily.amount_desc}`)).toBeTruthy();
});
test('refresh failures stop the spinner and surface a message', async () => {
  const sync = useFinanceStore.getState().runIncrementalSmsSync;
  useFinanceStore.setState({
    runIncrementalSmsSync: jest.fn().mockRejectedValue(new Error('sync failed')),
  });
  patchSnapshot(s => {
    s.settings = { ...s.settings, smsProcessingEnabled: true };
  });
  show();
  await act(async () => {
    await screen.UNSAFE_getByType(RefreshControl).props.onRefresh();
  });
  expect(appToast).toHaveBeenCalledWith(fa.daily.refreshError);
  expect(screen.UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false);
  act(() => {
    useFinanceStore.setState({ runIncrementalSmsSync: sync });
  });
});
