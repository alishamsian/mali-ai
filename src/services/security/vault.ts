import { Platform } from 'react-native';

/**
 * Biometric vault token via react-native-keychain.
 * Soft-fails everywhere — never throws to UI.
 * Exposes a session flag so LockGate does not re-lock while the system prompt is open.
 */

const SERVICE = 'ir.maliai.vault';

let keychain: typeof import('react-native-keychain') | null = null;
try {
  keychain = require('react-native-keychain');
} catch {
  keychain = null;
}

let sensitiveAuthDepth = 0;

export function beginSensitiveAuth(): void {
  sensitiveAuthDepth += 1;
}

export function endSensitiveAuth(): void {
  sensitiveAuthDepth = Math.max(0, sensitiveAuthDepth - 1);
}

export function isSensitiveAuthActive(): boolean {
  return sensitiveAuthDepth > 0;
}

export async function biometricAvailable(): Promise<boolean> {
  if (!keychain) {
    return false;
  }
  try {
    const type = await keychain.getSupportedBiometryType();
    if (!type) {
      return false;
    }
    if (typeof keychain.canImplyAuthentication === 'function') {
      const can = await keychain.canImplyAuthentication({
        authenticationType: keychain.AUTHENTICATION_TYPE.BIOMETRICS,
      });
      if (!can) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

export async function enrollVaultToken(): Promise<boolean> {
  if (!keychain) {
    return false;
  }
  beginSensitiveAuth();
  try {
    const available = await biometricAvailable();
    if (!available) {
      return false;
    }

    // Clear stale token first so re-enroll is clean
    try {
      await keychain.resetGenericPassword({ service: SERVICE });
    } catch {
      // ignore
    }

    const accessControl =
      Platform.OS === 'ios'
        ? keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE
        : keychain.ACCESS_CONTROL.BIOMETRY_ANY;

    const base = {
      service: SERVICE,
      accessible: keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      authenticationPrompt: {
        title: 'فعال‌سازی اثر انگشت',
        subtitle: 'برای باز کردن قفل خزانه',
        cancel: 'انصراف',
      },
    } as const;

    try {
      await keychain.setGenericPassword('mali', 'vault', {
        ...base,
        accessControl,
        ...(Platform.OS === 'android'
          ? {
              securityLevel: keychain.SECURITY_LEVEL.SECURE_HARDWARE,
              storage: keychain.STORAGE_TYPE.RSA,
            }
          : {}),
      });
      return true;
    } catch {
      try {
        await keychain.setGenericPassword('mali', 'vault', {
          ...base,
          accessControl,
          ...(Platform.OS === 'android'
            ? { securityLevel: keychain.SECURITY_LEVEL.SECURE_SOFTWARE }
            : {}),
        });
        return true;
      } catch {
        try {
          await keychain.setGenericPassword('mali', 'vault', {
            ...base,
            accessControl,
          });
          return true;
        } catch {
          try {
            await keychain.resetGenericPassword({ service: SERVICE });
          } catch {
            // ignore
          }
          return false;
        }
      }
    }
  } finally {
    endSensitiveAuth();
  }
}

export async function promptVaultBiometric(): Promise<boolean> {
  if (!keychain) {
    return false;
  }
  beginSensitiveAuth();
  try {
    const available = await biometricAvailable();
    if (!available) {
      return false;
    }
    const result = await keychain.getGenericPassword({
      service: SERVICE,
      authenticationPrompt: {
        title: 'ورود به پولت',
        subtitle: 'قفل خزانه',
        cancel: 'انصراف',
      },
    });
    return Boolean(result);
  } catch {
    return false;
  } finally {
    endSensitiveAuth();
  }
}

export async function clearVaultToken(): Promise<void> {
  if (!keychain) {
    return;
  }
  try {
    await keychain.resetGenericPassword({ service: SERVICE });
  } catch {
    // ignore
  }
}
