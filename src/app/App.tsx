import React, { useEffect } from 'react';
import { I18nManager, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RootNavigator } from './navigation/RootNavigator';
import { LockGate } from '../components/security/LockGate';
import { AppMotionBridge } from '../components/motion/AppMotionBridge';
import { useFinanceStore } from '../store/finance/store';
import { ThemeBridge, useAppTheme } from '../theme/ThemeBridge';
import { typography } from '../theme/typography';
import { t } from '../i18n';

const queryClient = new QueryClient();

/**
 * لایه‌اوت اپ با textAlign:'right' و alignItems:'flex-end' نوشته شده
 * (راست‌چین دستی برای فارسی). forceRTL باعث می‌شود right/end برعکس شوند
 * و متن‌ها بروند سمت چپ — پس RTL سیستمی را خاموش نگه می‌داریم
 * و فقط راست‌چین فیزیکی را اعمال می‌کنیم.
 *
 * مهم: forceRTL را فقط یک‌بار در عمر پروسس صدا بزن — تکرار آن روی اندروید
 * می‌تواند Activity را ری‌استارت کند و کاربر را از صفحه پرت کند بیرون.
 */
let layoutConfigured = false;
function configurePersianLayout() {
  if (layoutConfigured) {
    return;
  }
  layoutConfigured = true;
  try {
    I18nManager.allowRTL(true);
    I18nManager.swapLeftAndRightInRTL(false);
    if (I18nManager.isRTL) {
      I18nManager.forceRTL(false);
    }
  } catch {
    // ignore
  }
}

configurePersianLayout();

/** پس‌زمینه تم‌آگاه — بدون ریمونت children */
function ThemeRoot({ children }: { children: React.ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      {children}
    </GestureHandlerRootView>
  );
}

function AppShell() {
  return (
    <ThemeRoot>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AppMotionBridge>
            <LockGate>
              <RootNavigator />
            </LockGate>
          </AppMotionBridge>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ThemeRoot>
  );
}

function BootSplash() {
  // بدون subscribe به تم — تا App ریشه با هر تغییر تم دوباره درخت را نسازد
  return <View style={{ flex: 1, backgroundColor: '#DDE3E5' }} />;
}

/** Shown when the encrypted store cannot be opened. Saves nothing, so retry is safe. */
function StorageErrorScreen({
  code,
  detail,
  onRetry,
}: {
  code: string;
  detail?: string;
  onRetry: () => void;
}) {
  const copy = t().storageError;
  return (
    <View style={errorStyles.root}>
      <Text style={errorStyles.title}>{copy.title}</Text>
      <Text style={errorStyles.body}>{code === 'key-mismatch' ? copy.mismatch : copy.body}</Text>
      <Text style={errorStyles.code}>{__DEV__ && detail ? `${code} · ${detail}` : code}</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={errorStyles.button}>
        <Text style={errorStyles.buttonLabel}>{copy.retry}</Text>
      </Pressable>
    </View>
  );
}

const errorStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#DDE3E5', justifyContent: 'center', padding: 24, gap: 16 },
  title: {
    color: '#111316',
    fontSize: 20,
    fontFamily: typography.fontFamily.bold,
    textAlign: 'right',
  },
  body: {
    color: '#454B53',
    fontSize: 15,
    lineHeight: 26,
    fontFamily: typography.fontFamily.regular,
    textAlign: 'right',
  },
  code: { color: '#5F656D', fontSize: 12, textAlign: 'right' },
  button: {
    backgroundColor: '#111316',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonLabel: { color: '#fff', fontSize: 16, fontFamily: typography.fontFamily.semibold },
});

export default function App() {
  const hydrate = useFinanceStore(s => s.hydrate);
  const hydrated = useFinanceStore(s => s.hydrated);
  const storageError = useFinanceStore(s => s.storageError);
  // Keyed on the store's own state, not a component ref: Fast Refresh can rebuild the
  // store module (fresh, un-hydrated) while this component keeps its refs.
  useEffect(() => {
    if (!hydrated) {
      void hydrate();
    }
  }, [hydrate, hydrated]);

  /**
   * ThemeBridge همیشه بالای AppShell می‌ماند.
   * قبل از hydrate فقط اسپلش نشان بده — نه اینکه کل درخت را عوض کنی بعد از تم.
   */
  return (
    <ThemeBridge>
      {hydrated ? (
        <AppShell />
      ) : storageError ? (
        <StorageErrorScreen
          code={storageError.code}
          detail={storageError.detail}
          onRetry={() => void hydrate()}
        />
      ) : (
        <BootSplash />
      )}
    </ThemeBridge>
  );
}
