import React from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LockGate } from './LockGate';
import { useFinanceStore } from '../../store/finance/store';
import { useAuthStore } from '../../store/auth/store';
import { __resetPinMemoryForTests, storePin } from '../../services/security/pin';
import { fa } from '../../i18n/fa';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function renderGate() {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <LockGate>
        <Text>vault contents</Text>
      </LockGate>
    </SafeAreaProvider>,
  );
}

async function typePin(pin: string) {
  for (const digit of pin) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      fireEvent.press(screen.getByText(digit));
    });
  }
}

beforeAll(async () => {
  await useFinanceStore.getState().hydrate();
});

beforeEach(async () => {
  __resetPinMemoryForTests();
  await storePin('482913');
  useFinanceStore
    .getState()
    .updateSettings({ appLockEnabled: true, onboardingCompleted: true, biometricUnlock: false });
  useAuthStore.getState().lockVault();
});

describe('LockGate', () => {
  it('hides the app behind the PIN pad and opens with the right PIN', async () => {
    renderGate();
    await screen.findByText(fa.profile.unlock);
    expect(screen.queryByText('vault contents')).toBeNull();

    await typePin('482913');
    await waitFor(() => expect(screen.getByText('vault contents')).toBeTruthy());
  });

  it('shows an error on a wrong PIN and stays locked', async () => {
    renderGate();
    await screen.findByText(fa.profile.unlock);
    await typePin('000000');
    await screen.findByText(fa.profile.pinWrong);
    expect(screen.queryByText('vault contents')).toBeNull();
  });

  it('locks out after five wrong PINs, even with the right one after', async () => {
    renderGate();
    await screen.findByText(fa.profile.unlock);
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await typePin('000000');
    }
    await screen.findByText(fa.profile.pinLocked);
    await typePin('482913');
    expect(screen.queryByText('vault contents')).toBeNull();
  });

  it('shows the app directly when the lock is off', async () => {
    useFinanceStore.getState().updateSettings({ appLockEnabled: false });
    renderGate();
    await screen.findByText('vault contents');
  });
});
