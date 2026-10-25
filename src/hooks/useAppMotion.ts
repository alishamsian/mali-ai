import { useMemo } from 'react';
import { useReducedMotion } from 'react-native-reanimated';
import { animations } from '../theme/animations';
import { useFinanceStore } from '../store/finance/store';

export function useAppMotion() {
  const reducedSetting = useFinanceStore(s => Boolean(s.snapshot.settings.reducedMotion));
  const reducedOS = useReducedMotion();
  const reduced = reducedSetting || reducedOS;

  return useMemo(
    () => ({
      reduced,
      duration: {
        fast: reduced ? 0 : animations.duration.fast,
        normal: reduced ? 0 : animations.duration.normal,
        slow: reduced ? 0 : animations.duration.slow,
      },
      stackAnimation: (reduced ? 'none' : 'slide_from_left') as 'none' | 'slide_from_left',
      modalAnimation: (reduced ? 'fade' : 'slide') as 'fade' | 'slide' | 'none',
    }),
    [reduced],
  );
}
