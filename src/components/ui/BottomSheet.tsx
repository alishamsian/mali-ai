import React, { type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { AppText } from './AppText';
import { useAppMotion } from '../../hooks/useAppMotion';
import { useAppTheme } from '../../theme/ThemeBridge';
import { useThemedStyles } from '../../theme/useThemedStyles';

export function BottomSheet({
  visible,
  title,
  onClose,
  children,
  footer,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { modalAnimation } = useAppMotion();
  const styles = useThemedStyles((c, th) => ({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
    sheet: {
      maxHeight: '88%',
      borderTopLeftRadius: th.radii.xl,
      borderTopRightRadius: th.radii.xl,
      backgroundColor: c.surfaceSolid,
      borderWidth: 1,
      borderColor: c.border,
      borderBottomWidth: 0,
      paddingTop: 8,
      paddingHorizontal: th.spacing.lg,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: 'rgba(255,255,255,0.18)',
      marginBottom: th.spacing.sm,
    },
    head: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: th.spacing.sm,
      marginBottom: th.spacing.md,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    footer: { paddingTop: th.spacing.md, gap: th.spacing.sm },
  }));

  return (
    <Modal
      visible={visible}
      animationType={modalAnimation === 'none' ? 'none' : modalAnimation}
      transparent
      onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="بستن" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <AppText variant="title" style={{ flex: 1, textAlign: 'right' }}>
              {title}
            </AppText>
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <X size={18} color={colors.textMuted} strokeWidth={2} />
            </Pressable>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 8 }}>
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}
