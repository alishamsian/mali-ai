import React, { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Check, Trash2 } from 'lucide-react-native';
import { AppText } from '../ui/AppText';
import { PressScale } from '../ui/PressScale';
import { appToast } from '../ui/AppAlert';
import { t } from '../../i18n';
import { useFinanceStore } from '../../store/finance/store';
import { useAppTheme } from '../../theme/ThemeBridge';
import { hapticSuccess, hapticTap } from '../../utils/haptics';
import type { Transaction } from '../../types/finance';

const ACTION_WIDTH = 84;

/** Swipe left to delete (with undo); swipe right to confirm a row that needs review. */
export function SwipeTxRow({ tx, children }: { tx: Transaction; children: React.ReactNode }) {
  const { colors } = useAppTheme();
  const dict = t().swipe;
  const ref = useRef<SwipeableMethods>(null);
  const needsReview = tx.needsReview || !tx.isConfirmed;

  const action = (label: string, Icon: typeof Check, color: string, onPress: () => void) => (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        ref.current?.close();
        onPress();
      }}
      style={[styles.action, { backgroundColor: color }]}>
      <Icon size={20} color="#FFFFFF" />
      <AppText style={styles.label}>{label}</AppText>
    </PressScale>
  );

  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={1.6}
      overshootRight={false}
      overshootLeft={false}
      onSwipeableWillOpen={hapticTap}
      renderRightActions={() =>
        action(dict.delete, Trash2, '#C2410C', () => {
          // Delete at once and offer undo, rather than asking first.
          const store = useFinanceStore.getState();
          const removed = store.snapshot.transactions.find(item => item.id === tx.id);
          store.deleteTransaction(tx.id);
          if (removed) {
            appToast(dict.deleted, {
              label: dict.undo,
              onPress: () =>
                useFinanceStore.getState().addTransaction(removed, { allowDuplicate: true }),
            });
          }
        })
      }
      renderLeftActions={
        needsReview
          ? () =>
              action(dict.confirm, Check, colors.income, () => {
                hapticSuccess();
                useFinanceStore.getState().confirmTransaction(tx.id);
              })
          : undefined
      }>
      <View>{children}</View>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  action: {
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 18,
    marginVertical: 2,
  },
  label: { color: '#FFFFFF', fontSize: 12 },
});
