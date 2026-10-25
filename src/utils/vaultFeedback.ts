import { Vibration } from 'react-native';
import { hapticSuccess } from './haptics';

const LARGE_TX_RIAL = 5_000_000;

export function isLargeTransaction(amountRial: number): boolean {
  return amountRial >= LARGE_TX_RIAL;
}

/** لوکس haptic — جایگزین موقت تا فایل صدا اضافه شود */
export function playVaultChime(enabled: boolean): void {
  if (!enabled) {
    return;
  }
  hapticSuccess();
  try {
    Vibration.vibrate([0, 18, 50, 24, 70, 30]);
  } catch {
    // ignore
  }
}
