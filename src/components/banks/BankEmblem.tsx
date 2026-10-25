import React from 'react';
import { Image } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { resolveBankLogo } from './bankLogos';

function GenericEmblem({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Rect x="8" y="16" width="32" height="20" rx="4" fill="rgba(255,255,255,0.18)" />
      <Rect x="12" y="20" width="10" height="8" rx="1" fill="rgba(212,180,131,0.7)" />
    </Svg>
  );
}

export function BankEmblem({
  bankId,
  size = 52,
}: {
  bankId?: string;
  size?: number;
}) {
  const source = resolveBankLogo(bankId);
  if (!source) {
    return <GenericEmblem size={size} />;
  }

  return (
    <Image
      source={source}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}
