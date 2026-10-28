import React from 'react';
import { NightCanvas } from './NightCanvas';

/** Gives a screen that paints no backdrop of its own the shared glass canvas. */
export function withCanvas<P extends object>(Screen: React.ComponentType<P>): React.FC<P> {
  function Canvased(props: P) {
    return (
      <NightCanvas>
        <Screen {...props} />
      </NightCanvas>
    );
  }
  Canvased.displayName = `withCanvas(${Screen.displayName ?? Screen.name})`;
  return Canvased;
}
