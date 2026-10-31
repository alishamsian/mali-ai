import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './AppText';
import { GlassPanel } from './GlassPanel';
import { PressScale } from './PressScale';
import { useAppTheme } from '../../theme/ThemeBridge';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { hapticTap } from '../../utils/haptics';

export type AppAlertButton = {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

type Request = { title: string; message?: string; buttons: AppAlertButton[] };

let show: ((request: Request) => void) | null = null;

type Toast = { message: string; action?: { label: string; onPress: () => void } };
let showToast: ((toast: Toast) => void) | null = null;
const TOAST_MS = 5000;

/** A short glass message above the tab bar, with an optional action such as undo. */
export function appToast(message: string, action?: Toast['action']): void {
  showToast?.({ message, action });
}

/**
 * Drop-in for Alert.alert that renders as a glass bottom sheet. Falls back to a
 * no-op-safe single OK when the host is not mounted yet.
 */
export function appAlert(title: string, message?: string, buttons?: AppAlertButton[]): void {
  const request = { title, message, buttons: buttons?.length ? buttons : [{ text: 'باشه' }] };
  if (show) {
    show(request);
  } else {
    request.buttons.find(b => b.style !== 'cancel')?.onPress?.();
  }
}

/** Mount once at the app root. */
export function AppAlertHost() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const [request, setRequest] = useState<Request | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  useEffect(() => {
    show = setRequest;
    showToast = setToast;
    return () => {
      show = null;
      showToast = null;
    };
  }, []);
  useEffect(() => {
    if (!toast) {
      return;
    }
    const id = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(id);
  }, [toast]);

  const styles = useThemedStyles((c, th) => ({
    sheet: { margin: 12, marginBottom: insets.bottom + 20, padding: 18, gap: 10 },
    title: {
      textAlign: 'right',
      fontSize: 17,
      color: c.text,
      fontFamily: th.typography.fontFamily.semibold,
    },
    message: { textAlign: 'right', fontSize: 14, lineHeight: 22, color: c.textSecondary },
    button: { minHeight: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    buttonText: { fontSize: 15, fontFamily: th.typography.fontFamily.semibold },
    toast: {
      marginHorizontal: 16,
      paddingVertical: 10,
      paddingHorizontal: 14,
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 12,
    },
    toastText: {
      flex: 0,
      fontSize: 14,
      color: c.text,
      fontFamily: th.typography.fontFamily.semibold,
    },
    toastAction: {
      marginRight: 'auto',
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
  }));

  const close = (button?: AppAlertButton) => {
    setRequest(null);
    if (button?.onPress) {
      // Let the sheet close first so a follow-up sheet can open cleanly.
      setTimeout(button.onPress, 180);
    }
  };
  const cancel = request?.buttons.find(b => b.style === 'cancel');
  // Cancel goes last, like a native action sheet.
  const ordered = request
    ? [...request.buttons.filter(b => b !== cancel), ...(cancel ? [cancel] : [])]
    : [];

  return (
    <>
      {toast ? (
        <View
          pointerEvents="box-none"
          style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]}>
          <GlassPanel
            strong
            radius={20}
            style={[styles.toast, { marginBottom: insets.bottom + 96 }]}
            accessibilityLiveRegion="polite">
            <AppText style={styles.toastText}>{toast.message}</AppText>
            {toast.action ? (
              <PressScale
                accessibilityRole="button"
                onPress={() => {
                  hapticTap();
                  toast.action?.onPress();
                  setToast(null);
                }}
                style={[styles.toastAction, { backgroundColor: colors.primary }]}>
                <AppText style={[styles.toastText, { color: colors.onPrimary }]}>
                  {toast.action.label}
                </AppText>
              </PressScale>
            ) : null}
          </GlassPanel>
        </View>
      ) : null}
      <Modal
        visible={request != null}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => close(cancel)}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(8,12,16,0.35)' }]}
          onPress={() => close(cancel)}
        />
        <View style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
          {request ? (
            <GlassPanel strong radius={28} style={styles.sheet} accessibilityViewIsModal>
              <AppText style={styles.title}>{request.title}</AppText>
              {request.message ? <AppText style={styles.message}>{request.message}</AppText> : null}
              <View style={{ gap: 8, marginTop: 6 }}>
                {ordered.map((button, i) => {
                  const destructive = button.style === 'destructive';
                  const primary = i === 0 && button.style !== 'cancel' && !destructive;
                  return (
                    <PressScale
                      key={`${button.text}-${i}`}
                      accessibilityRole="button"
                      onPress={() => {
                        hapticTap();
                        close(button);
                      }}
                      style={[
                        styles.button,
                        {
                          backgroundColor: primary
                            ? colors.primary
                            : button.style === 'cancel'
                            ? 'transparent'
                            : colors.glass,
                        },
                      ]}>
                      <AppText
                        style={[
                          styles.buttonText,
                          {
                            color: primary
                              ? colors.onPrimary
                              : destructive
                              ? '#C2410C'
                              : button.style === 'cancel'
                              ? colors.textMuted
                              : colors.text,
                          },
                        ]}>
                        {button.text ?? 'باشه'}
                      </AppText>
                    </PressScale>
                  );
                })}
              </View>
            </GlassPanel>
          ) : null}
        </View>
      </Modal>
    </>
  );
}
