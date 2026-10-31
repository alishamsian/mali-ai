import React from 'react';
import { View } from 'react-native';

/** A rounded bar that fills from the right, like the rest of the RTL layout. */
export function ProgressBar({
  progress,
  color,
  track,
  height = 8,
}: {
  progress: number;
  color: string;
  track: string;
  height?: number;
}) {
  const share = Math.max(0, Math.min(1, progress));
  return (
    <View
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: track,
        flexDirection: 'row-reverse',
        overflow: 'hidden',
      }}>
      <View
        style={{ width: `${share * 100}%`, backgroundColor: color, borderRadius: height / 2 }}
      />
    </View>
  );
}
