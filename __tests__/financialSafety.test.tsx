import React from 'react';
import { Text } from 'react-native';
import { render, screen, waitFor, cleanup } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LockGate } from '../src/components/security/LockGate';
import { useAuthStore } from '../src/store/auth/store';
import { useFinanceStore } from '../src/store/finance/store';
import { storePin, __resetPinMemoryForTests } from '../src/services/security/pin';
import { emptySnapshot } from '../src/database/schema/snapshot';
import { buildSanitizedBackup, resolveBackupInput } from '../src/services/security/backup';
import { resolveUnitPriceRial } from '../src/features/wealth/pricing/symbols';
import { revalueFromDetails } from '../src/features/wealth/engine/portfolio';
import { pullCloudRecords } from '../src/services/sync/pull';
import { monthlyTotals } from '../src/engine/insights/analytics';
import { runSmsPipeline } from '../src/features/sms/pipeline/run';
import { cloudTransactionPayload } from '../src/services/sync/flush';
import type { Transaction, FinancialAccount } from '../src/types/finance';

jest.mock('../src/services/sync/pull', () => ({ pullCloudRecords: jest.fn() }));
const stamp = '2026-10-30T12:00:00.000Z';
const account = (id: string, balanceRial = 10000): FinancialAccount => ({
  id,
  userId: 'local-user',
  kind: 'bank',
  name: id,
  balanceRial,
  transactionCount: 0,
  createdAt: stamp,
  updatedAt: stamp,
});
const tx = (id: string, accountId: string, patch: Partial<Transaction> = {}): Transaction => ({
  id,
  accountId,
  userId: 'local-user',
  type: 'purchase',
  direction: 'out',
  amountRial: 1000,
  currency: 'IRR',
  categoryId: 'food',
  transactionDate: stamp,
  source: 'manual',
  fingerprint: id,
  confidence: 1,
  isConfirmed: true,
  needsReview: false,
  createdAt: stamp,
  updatedAt: stamp,
  ...patch,
});
const state = () => useFinanceStore.getState();
beforeAll(async () => {
  await state().hydrate();
});
beforeEach(() => {
  useFinanceStore.setState({ snapshot: emptySnapshot() });
  __resetPinMemoryForTests();
  jest.clearAllMocks();
});
afterEach(cleanup);

test('cold start must require the configured PIN', async () => {
  await storePin('482913');
  state().updateSettings({ appLockEnabled: true, onboardingCompleted: true });
  useAuthStore.setState(useAuthStore.getInitialState());
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}>
      <LockGate>
        <Text>private ledger</Text>
      </LockGate>
    </SafeAreaProvider>,
  );
  await waitFor(() => expect(screen.queryByText('private ledger')).toBeNull());
});

test('enabled app lock must not silently disable when PIN storage is missing', async () => {
  state().updateSettings({ appLockEnabled: true, onboardingCompleted: true });
  useAuthStore.getState().lockVault();
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}>
      <LockGate>
        <Text>private ledger</Text>
      </LockGate>
    </SafeAreaProvider>,
  );
  await waitFor(() => expect(screen.queryByText('private ledger')).toBeNull());
  expect(state().snapshot.settings.appLockEnabled).toBe(true);
});

test('editing a paired transfer must preserve the transfer registry', () => {
  state().upsertAccount(account('a'));
  state().upsertAccount(account('b'));
  state().addTransaction(tx('out', 'a', { categoryId: 'transfer' }));
  state().addTransaction(
    tx('in', 'b', { direction: 'in', type: 'deposit', categoryId: 'transfer' }),
  );
  expect(state().snapshot.transfers).toHaveLength(1);
  state().updateTransaction('out', { notes: 'edited' });
  expect(state().snapshot.transfers).toHaveLength(1);
});

test('an unrelated purchase and salary must not become an own-account transfer', () => {
  state().upsertAccount(account('a'));
  state().upsertAccount(account('b'));
  state().addTransaction(tx('shop', 'a', { merchant: 'supermarket', categoryId: 'shopping' }));
  state().addTransaction(
    tx('salary', 'b', {
      direction: 'in',
      type: 'deposit',
      merchant: 'employer',
      categoryId: 'income',
    }),
  );
  expect(state().snapshot.transfers).toHaveLength(0);
});

test('deleting a paired incoming manual transfer must reverse its balance', () => {
  state().upsertAccount(account('a'));
  state().upsertAccount(account('b'));
  state().addTransaction(tx('out', 'a', { categoryId: 'transfer' }));
  state().addTransaction(
    tx('in', 'b', { direction: 'in', type: 'deposit', categoryId: 'transfer' }),
  );
  state().deleteTransaction('in');
  expect(state().snapshot.accounts.find(a => a.id === 'b')?.balanceRial).toBe(10000);
});

test('deleting one transfer leg must restore the remaining expense and balance', () => {
  state().upsertAccount(account('a'));
  state().upsertAccount(account('b'));
  state().addTransaction(tx('out', 'a', { categoryId: 'transfer' }));
  state().addTransaction(
    tx('in', 'b', { direction: 'in', type: 'deposit', categoryId: 'transfer' }),
  );
  state().deleteTransaction('in');
  expect(monthlyTotals(state().snapshot.transactions).expenseRial).toBe(1000);
  expect(state().snapshot.accounts.find(a => a.id === 'b')?.balanceRial).toBe(10000);
});

test('one mithqal must be worth one quoted mithqal after live repricing', () => {
  const a = {
    ...account('gold'),
    kind: 'asset',
    assetClass: 'gold',
    details: {
      class: 'gold',
      goldType: 'karat18',
      unit: 'mithqal',
      weight: 1,
      purchasePriceRial: 0,
      currentPricePerUnitRial: 0,
    },
  } as FinancialAccount;
  const unit = resolveUnitPriceRial(a, {
    asOf: stamp,
    source: 'tgju',
    quotes: { gold_mesghal: 92000000 },
  })!;
  const valued = revalueFromDetails({
    ...a,
    details: { ...a.details!, currentPricePerUnitRial: unit },
  } as FinancialAccount);
  expect(valued.balanceRial).toBe(92000000);
});

test('backup must reject malformed obligation rows before replacing data', () => {
  const data = {
    ...buildSanitizedBackup(emptySnapshot()),
    installmentPlans: [null],
    cheques: [null],
    debts: [null],
  };
  expect(resolveBackupInput(JSON.stringify(data)).ok).toBe(false);
});

test('generic SMS raw card data must not leave through cloud or backup description', () => {
  const card = '6037991234567890';
  const body = `بانک سامان برداشت مبلغ 100000 ریال از کارت ${card} مانده 900000 ریال`;
  const result = runSmsPipeline({
    userId: 'local-user',
    accountId: 'a',
    raw: { sender: 'Saman', body, receivedAt: stamp },
    existing: [],
    forcedBankId: 'saman',
  });
  expect(result.transaction).toBeTruthy();
  const transaction = tx('sms', 'a', result.transaction);
  const snap = emptySnapshot();
  snap.transactions = [transaction];
  expect([
    JSON.stringify(cloudTransactionPayload(transaction)).includes(card),
    JSON.stringify(buildSanitizedBackup(snap)).includes(card),
  ]).toEqual([false, false]);
});

test('cloud restore of a missing manual expense must update an existing account balance', async () => {
  state().upsertAccount(account('a', 10000));
  (pullCloudRecords as jest.Mock).mockResolvedValue({
    ok: true,
    records: { accounts: [account('a', 9000)], transactions: [tx('cloud', 'a')], skipped: 0 },
  });
  await state().restoreFromCloud();
  expect(state().snapshot.accounts.find(a => a.id === 'a')?.balanceRial).toBe(9000);
});

test('restoring backup must replace stale queued transaction payloads', () => {
  state().upsertAccount(account('a'));
  state().addTransaction(tx('t', 'a', { amountRial: 1000 }));
  const data = buildSanitizedBackup(state().snapshot);
  data.transactions = [tx('t', 'a', { amountRial: 500 })];
  expect(state().importBackupJson(JSON.stringify(data)).ok).toBe(true);
  const queued = state().snapshot.syncQueue.find(q => q.entityId === 't');
  expect(JSON.parse(queued!.payload).amountRial).toBe(500);
});

test('generic outgoing bank transfers remain spending until an own-account pair exists', () => {
  const result = runSmsPipeline({
    userId: 'local-user',
    accountId: 'a',
    raw: {
      sender: 'Saman',
      body: 'بانک سامان انتقال مبلغ 100000 ریال به کارت ****1234 مانده 900000 ریال',
      receivedAt: stamp,
    },
    existing: [],
    forcedBankId: 'saman',
  });
  expect(result.transaction?.direction).toBe('out');
  expect(monthlyTotals([tx('external', 'a', result.transaction)]).expenseRial).toBe(100000);
});

test('generic Toman SMS balances are normalized to Rial as well as amounts', () => {
  const result = runSmsPipeline({
    userId: 'local-user',
    accountId: 'a',
    raw: {
      sender: 'Saman',
      body: 'بانک سامان برداشت مبلغ 10000 تومان مانده 90000 تومان',
      receivedAt: stamp,
    },
    existing: [],
    forcedBankId: 'saman',
  });
  expect(result.transaction?.amountRial).toBe(100000);
  expect(result.transaction?.balanceAfterRial).toBe(900000);
});
