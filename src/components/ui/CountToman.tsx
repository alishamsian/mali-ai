import React, { useEffect, useRef, useState } from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import { formatTomanFromRial } from '../../utils/currency/money';
import { MoneyText } from './MoneyText';
import { theme } from '../../theme';
import { useFinanceStore } from '../../store/finance/store';

export function CountToman({
  rial,
  hidden,
  style,
}: {
  rial: number;
  hidden: boolean;
  style?: StyleProp<TextStyle>;
}) {
  const reduced = useFinanceStore(s => s.snapshot.settings.reducedMotion);
  const [shown, setShown] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    if (hidden || reduced) {
      current.current = rial;
      setShown(rial);
      return;
    }
    const from = current.current;
    const start = Date.now();
    const duration = 720;
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      const next = Math.round(from + (rial - from) * eased);
      setShown(next);
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        current.current = rial;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [rial, hidden, reduced]);

  return (
    <MoneyText
      minFontScale={0.45}
      align="right"
      style={[{ width: '100%', fontSize: theme.typography.size.display }, style]}>
      {hidden ? '••••••••' : formatTomanFromRial(shown)}
    </MoneyText>
  );
}
