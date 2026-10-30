import React from 'react';
import { emptySnapshot } from '../../../database/schema/snapshot';
import { applyGuestPreview } from '../../../database/seed/guestPreview';
import * as AppAlert from '../../../components/ui/AppAlert';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AddTransactionScreen } from './AddTransactionScreen';
import { useFinanceStore } from '../../../store/finance/store';
import { fa } from '../../../i18n/fa';
import type { FinancialAccount, Transaction } from '../../../types/finance';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const navigation = { goBack: jest.fn(), navigate: jest.fn() } as never;
const route = { key: 'add', name: 'AddTransaction', params: { mode: 'expense' } } as never;

const state = () => useFinanceStore.getState();
const manualTxs = () => state().snapshot.transactions.filter(t => t.source === 'manual');

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AddTransactionScreen navigation={navigation} route={route} />
    </SafeAreaProvider>,
  );
}

/** Keypad labels are Persian digits. */
function typeAmount(persianDigits: string[]) {
  for (const label of persianDigits) {
    fireEvent.press(screen.getByText(label));
  }
}

function pressSave() {
  fireEvent.press(screen.getByText(new RegExp(fa.add.saveExpense)));
}

const wallet: FinancialAccount = {
  id: 'acc_ui_wallet',
  userId: 'local-user',
  kind: 'cash',
  name: 'کیف پول',
  balanceRial: 10_000_000,
  transactionCount: 0,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

beforeAll(async () => {
  await state().hydrate();
  state().upsertAccount(wallet);
  state().updateSettings({ defaultAccountId: wallet.id });
});

describe('AddTransactionScreen', () => {
  it('saves an expense typed on the keypad, and undo removes it', () => {
    renderScreen();
    const before = manualTxs().length;
    typeAmount(['۱', '۲', '۰۰۰']);
    pressSave();

    expect(screen.getByText(fa.add.saved)).toBeTruthy();
    const added = manualTxs();
    expect(added).toHaveLength(before + 1);
    expect(added[0]).toMatchObject({ amountRial: 120_000, direction: 'out', accountId: wallet.id });
    expect(state().snapshot.accounts.find(a => a.id === wallet.id)?.balanceRial).toBe(9_880_000);

    fireEvent.press(screen.getByText(fa.add.undo));
    expect(manualTxs()).toHaveLength(before);
    expect(state().snapshot.accounts.find(a => a.id === wallet.id)?.balanceRial).toBe(10_000_000);
  });

  it('does not save without an amount', () => {
    renderScreen();
    const before = manualTxs().length;
    fireEvent.press(screen.getByText(fa.add.enterAmountFirst));
    expect(screen.getByText(fa.add.needAmount)).toBeTruthy();
    expect(manualTxs()).toHaveLength(before);
  });

  it('asks before saving what looks like an SMS transaction already recorded', () => {
    const sms: Transaction = {
      id: 'tx_ui_sms',
      userId: 'local-user',
      accountId: wallet.id,
      type: 'purchase',
      direction: 'out',
      amountRial: 4_560_000,
      currency: 'IRR',
      categoryId: 'food',
      transactionDate: new Date().toISOString(),
      source: 'android_sms',
      fingerprint: 'fp_ui_sms',
      confidence: 1,
      isConfirmed: true,
      needsReview: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state().addTransaction(sms);
    const alert = jest.spyOn(AppAlert, 'appAlert').mockImplementation(() => undefined);

    renderScreen();
    const before = manualTxs().length;
    typeAmount(['۴', '۵', '۶', '۰', '۰', '۰']);
    pressSave();

    expect(alert).toHaveBeenCalledWith(fa.add.duplicateTitle, expect.any(String), expect.any(Array));
    expect(manualTxs()).toHaveLength(before);

    const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    act(() => {
      buttons.find(b => b.text === fa.add.saveAnyway)!.onPress!();
    });
    expect(manualTxs()).toHaveLength(before + 1);
    alert.mockRestore();
  });
});


test('first real expense leaves the demo and creates a persistent real wallet', () => {
  const before = state().snapshot;
  const guest = applyGuestPreview(emptySnapshot());
  useFinanceStore.setState({ snapshot: guest });
  try {
    renderScreen();
    typeAmount(['۱', '۲', '۰۰۰']);
    pressSave();
    const snap = state().snapshot;
    expect(snap.settings.guestPreviewActive).toBe(false);
    expect(snap.transactions).toHaveLength(1);
    expect(snap.transactions[0].accountId).not.toMatch(/^guest_/);
    expect(snap.accounts.some(a => a.id === snap.transactions[0].accountId)).toBe(true);
    expect(snap.accounts.some(a => a.id.startsWith('guest_'))).toBe(false);
  } finally {
    useFinanceStore.setState({ snapshot: before });
  }
});
