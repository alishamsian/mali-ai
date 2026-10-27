import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ReviewInboxScreen } from './ReviewInboxScreen';
import { useFinanceStore } from '../../../store/finance/store';
import { fa } from '../../../i18n/fa';
import type { Transaction } from '../../../types/finance';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};
const navigation = { goBack: jest.fn(), navigate: jest.fn() } as never;
const state = () => useFinanceStore.getState();
const find = (id: string) => state().snapshot.transactions.find(t => t.id === id);

function reviewTx(id: string, merchant: string, amountRial: number): Transaction {
  const now = new Date().toISOString();
  return {
    id,
    userId: 'local-user',
    accountId: 'acc_review',
    type: 'purchase',
    direction: 'out',
    amountRial,
    currency: 'IRR',
    merchant,
    categoryId: 'other',
    transactionDate: now,
    source: 'android_sms',
    sourceSmsId: id,
    fingerprint: `fp-${id}`,
    confidence: 0.4,
    isConfirmed: false,
    needsReview: true,
    createdAt: now,
    updatedAt: now,
  };
}

function renderInbox() {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ReviewInboxScreen navigation={navigation} />
    </SafeAreaProvider>,
  );
}

beforeAll(async () => {
  await state().hydrate();
});

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('ReviewInboxScreen', () => {
  it('confirms one item and undo puts it back in review', () => {
    state().addTransaction(reviewTx('rv_1', 'نانوایی سنگک', 31_000));
    renderInbox();
    expect(screen.getByText('نانوایی سنگک')).toBeTruthy();

    fireEvent.press(screen.getByLabelText(new RegExp(`^${fa.sms.confirm}: نانوایی سنگک`)));
    expect(find('rv_1')).toMatchObject({ isConfirmed: true, needsReview: false });
    expect(screen.getByText(fa.sms.confirmedToast)).toBeTruthy();

    fireEvent.press(screen.getByText(fa.sms.undo));
    expect(find('rv_1')).toMatchObject({ isConfirmed: false, needsReview: true });
  });

  it('delete removes the item and undo restores it', () => {
    state().addTransaction(reviewTx('rv_2', 'کافه نادری', 64_000));
    renderInbox();
    const deleteButtons = screen.getAllByLabelText(fa.transactions.delete);
    // Rows are newest first: rv_2 was added last.
    fireEvent.press(deleteButtons[0]);
    expect(find('rv_2')).toBeUndefined();

    fireEvent.press(screen.getByText(fa.sms.undo));
    expect(find('rv_2')).toBeDefined();
  });

  it('confirm all clears the queue, and the undo toast expires', () => {
    state().addTransaction(reviewTx('rv_3', 'سوپرمارکت', 99_000));
    renderInbox();
    fireEvent.press(screen.getByText(fa.sms.confirmAll));
    expect(state().snapshot.transactions.filter(t => t.needsReview && !t.isConfirmed)).toHaveLength(0);

    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(screen.queryByText(fa.sms.undo)).toBeNull();
  });
});
