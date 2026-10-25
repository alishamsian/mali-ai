import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { AppText } from '../../../components/ui/AppText';
import { PrimaryButton } from '../../../components/ui/PrimaryButton';
import type { MonthClosingStory } from '../../../engine/moments/monthMoments';

export function MonthClosingOverlay({
  story,
  visible,
  onClose,
}: {
  story: MonthClosingStory | null;
  visible: boolean;
  onClose: () => void;
}) {
  const reduced = useReducedMotion();
  const [lineIndex, setLineIndex] = useState(0);
  const seal = useSharedValue(0);

  useEffect(() => {
    if (!visible || !story) {
      setLineIndex(0);
      return;
    }
    setLineIndex(0);
    seal.value = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (!reduced) {
      seal.value = withTiming(1, { duration: 1200 });
      timers.push(setTimeout(() => setLineIndex(1), 1600));
      timers.push(setTimeout(() => setLineIndex(2), 3200));
    } else {
      setLineIndex(2);
    }
    return () => timers.forEach(clearTimeout);
  }, [visible, story, reduced, seal]);

  if (!story) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <LinearGradient colors={['#0A0E14', '#040608']} style={styles.backdrop}>
        <Animated.View entering={FadeIn.duration(500)} style={styles.box}>
          <AppText variant="kicker" style={styles.kicker}>
            آیین بستن ماه
          </AppText>
          <AppText variant="title" style={styles.head}>
            ماه بسته شد
          </AppText>
          <View style={styles.lines}>
            {story.lines.map((line, i) =>
              i <= lineIndex ? (
                <Animated.View key={line} entering={FadeInDown.duration(400)}>
                  <AppText style={styles.line}>{line}</AppText>
                </Animated.View>
              ) : null,
            )}
          </View>
          {lineIndex >= 2 ? (
            <PrimaryButton label="ماه تازه را باز کن" onPress={onClose} />
          ) : (
            <Pressable style={{ height: 54 }} />
          )}
        </Animated.View>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: 24 },
  box: {
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(212,180,131,0.25)',
    backgroundColor: 'rgba(16,22,28,0.92)',
  },
  kicker: { textAlign: 'center', color: '#D4B483', marginBottom: 8 },
  head: { textAlign: 'center', fontSize: 28, marginBottom: 20 },
  lines: { gap: 16, marginBottom: 24 },
  line: { textAlign: 'right', lineHeight: 28, color: 'rgba(243,241,234,0.9)', fontSize: 15 },
});
