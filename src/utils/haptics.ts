import { Platform, Vibration } from 'react-native';

/** Android needs VIBRATE in manifest; native throws SecurityException without it. */
let vibrateBlocked = false;

function safeVibrate(pattern: number | number[]): void {
  if (vibrateBlocked) {
    return;
  }
  try {
    Vibration.vibrate(pattern);
  } catch {
    vibrateBlocked = true;
  }
}

export function hapticTap(): void {
  if (Platform.OS === 'web') {
    return;
  }
  safeVibrate(14);
}

export function hapticSuccess(): void {
  if (Platform.OS === 'web') {
    return;
  }
  safeVibrate([0, 18, 40, 22]);
}

export function hapticWarn(): void {
  if (Platform.OS === 'web') {
    return;
  }
  safeVibrate([0, 30, 40, 30]);
}
