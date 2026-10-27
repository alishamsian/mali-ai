import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fingerprint } from 'lucide-react-native';
import { useAppTheme } from '../../theme/ThemeBridge';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { AppText } from '../ui/AppText';
import { NightCanvas } from '../ui/NightCanvas';
import { useAuthStore } from '../../store/auth/store';
import { useFinanceStore } from '../../store/finance/store';
import {
  hasStoredPin,
  pinLockRemainingMs,
  pinMatches,
  recordPinFailure,
  recordPinSuccess,
} from '../../services/security/pin';
import { isSensitiveAuthActive, promptVaultBiometric } from '../../services/security/vault';
import { hapticSuccess, hapticWarn } from '../../utils/haptics';
import { t } from '../../i18n';

const PIN_LENGTH = 6;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'] as const;

export function LockGate({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useThemedStyles(c => ({
    root: { flex: 1 },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 1000,
      elevation: 1000,
    },
    overlayCanvas: { flex: 1 },
    wrap: { flex: 1, paddingHorizontal: 28, alignItems: 'center' },
    center: { textAlign: 'center', marginTop: 16 },
    mark: {
      width: 72,
      height: 72,
      borderRadius: 20,
      backgroundColor: c.primary,
      transform: [{ rotate: '8deg' }],
    },
    dots: { flexDirection: 'row-reverse', gap: 10, marginVertical: 28 },
    dot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: c.border,
    },
    dotOn: { backgroundColor: c.primary, borderColor: c.primary },
    dotErr: { borderColor: c.expense },
    err: { color: c.expense, marginBottom: 8 },
    bio: { alignItems: 'center', gap: 8, marginBottom: 16 },
    pad: { flexDirection: 'row', flexWrap: 'wrap', width: 276, justifyContent: 'center' },
    key: {
      width: 84,
      height: 64,
      alignItems: 'center',
      justifyContent: 'center',
      margin: 4,
      borderRadius: 18,
      backgroundColor: 'rgba(16,24,28,0.8)',
      borderWidth: 1,
      borderColor: c.border,
    },
    keyGhost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  }));
  const enabled = useFinanceStore(s => s.snapshot.settings.appLockEnabled);
  const onboarded = useFinanceStore(s => s.snapshot.settings.onboardingCompleted);
  const biometricUnlock = useFinanceStore(s => s.snapshot.settings.biometricUnlock);
  const updateSettings = useFinanceStore(s => s.updateSettings);
  const unlocked = useAuthStore(s => s.vaultUnlocked);
  const lock = useAuthStore(s => s.lockVault);
  const unlock = useAuthStore(s => s.unlockVault);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [lockMs, setLockMs] = useState(0);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const bioTried = useRef(false);
  const dict = t();

  const refreshPinState = useCallback(async () => {
    try {
      const ok = await hasStoredPin();
      const remaining = await pinLockRemainingMs();
      setHasPin(ok);
      setLockMs(remaining);
      if (enabled && !ok) {
        updateSettings({ appLockEnabled: false, biometricUnlock: false });
        unlock();
      }
      if (!enabled) {
        unlock();
      }
    } catch {
      setHasPin(false);
      if (enabled) {
        updateSettings({ appLockEnabled: false, biometricUnlock: false });
        unlock();
      }
    }
  }, [enabled, unlock, updateSettings]);

  useEffect(() => {
    void refreshPinState();
  }, [refreshPinState]);

  useEffect(() => {
    if (lockMs <= 0) {
      return;
    }
    const timer = setTimeout(() => setLockMs(ms => Math.max(0, ms - 1000)), 1000);
    return () => clearTimeout(timer);
  }, [lockMs]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (isSensitiveAuthActive()) {
        return;
      }
      if (state === 'background' && enabled) {
        lock();
        setPin('');
        setError(false);
        bioTried.current = false;
      }
    });
    return () => sub.remove();
  }, [enabled, lock]);

  const showLock =
    enabled && onboarded && !unlocked && hasPin === true;

  const locked = lockMs > 0;

  const tryBiometric = useCallback(async () => {
    if (busy || locked || !biometricUnlock) {
      return;
    }
    setBusy(true);
    try {
      const ok = await promptVaultBiometric();
      if (ok) {
        hapticSuccess();
        unlock();
        setPin('');
        setError(false);
      }
    } catch {
      // cancel / hardware — stay on PIN pad
    } finally {
      setBusy(false);
    }
  }, [biometricUnlock, busy, locked, unlock]);

  useEffect(() => {
    if (!showLock || !biometricUnlock || bioTried.current || locked) {
      return;
    }
    bioTried.current = true;
    const tmr = setTimeout(() => {
      void tryBiometric();
    }, 350);
    return () => clearTimeout(tmr);
  }, [showLock, biometricUnlock, locked, tryBiometric]);

  const push = async (key: string) => {
    if (locked || busy || submitting.current) {
      return;
    }
    if (key === '⌫') {
      setPin(p => p.slice(0, -1));
      setError(false);
      return;
    }
    if (!key || pin.length >= PIN_LENGTH) {
      return;
    }
    const next = pin + key;
    setPin(next);
    if (next.length !== PIN_LENGTH) {
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      const ok = await pinMatches(next);
      if (ok) {
        await recordPinSuccess();
        hapticSuccess();
        unlock();
        setPin('');
        setError(false);
      } else {
        const wait = await recordPinFailure();
        hapticWarn();
        setError(true);
        setPin('');
        setLockMs(wait);
      }
    } catch {
      hapticWarn();
      setError(true);
      setPin('');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  if (showLock) {
    return (
      <View style={styles.root}>
        <View style={styles.overlay} pointerEvents="auto">
          <NightCanvas style={styles.overlayCanvas}>
            <View style={[styles.wrap, { paddingTop: insets.top + 48 }]}>
              <View style={styles.mark} />
              <AppText variant="title" style={styles.center}>
                {dict.profile.unlock}
              </AppText>
              <View style={styles.dots}>
                {Array.from({ length: PIN_LENGTH }, (_, i) => (
                  <View
                    key={i}
                    style={[styles.dot, pin.length > i && styles.dotOn, error && styles.dotErr]}
                  />
                ))}
              </View>
              {locked ? (
                <AppText variant="caption" style={styles.err}>
                  {dict.profile.pinLocked}
                </AppText>
              ) : error ? (
                <AppText variant="caption" style={styles.err}>
                  {dict.profile.pinWrong}
                </AppText>
              ) : null}
              {biometricUnlock ? (
                <Pressable onPress={() => void tryBiometric()} style={styles.bio} disabled={busy}>
                  <Fingerprint color={colors.primary} size={22} />
                  <AppText variant="kicker">{dict.profile.biometric}</AppText>
                </Pressable>
              ) : null}
              <View style={styles.pad}>
                {KEYS.map((k, index) => (
                  <Pressable
                    key={`${k}-${index}`}
                    onPress={() => void push(k)}
                    style={[styles.key, !k && styles.keyGhost]}
                    disabled={!k || locked || busy}>
                    <AppText variant="title">{k}</AppText>
                  </Pressable>
                ))}
              </View>
            </View>
          </NightCanvas>
        </View>
      </View>
    );
  }

  return <View style={styles.root}>{children}</View>;
}
