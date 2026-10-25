import type { ImageSourcePropType } from 'react-native';

export type OnboardingSlideId = 'welcome' | 'auto' | 'banks' | 'privacy';

export interface OnboardingSlideConfig {
  id: OnboardingSlideId;
  titleKey: 'welcomeTitle' | 'autoTitle' | 'banksTitle' | 'smsTitle';
  bodyKey: 'welcomeBody' | 'autoBody' | 'banksBody' | 'smsBody';
  kickerKey?: 'welcomeKicker' | 'autoKicker' | 'banksKicker' | 'smsKicker';
  accent: string;
  accentGlow: string;
  /** پرامپت ساخت تصویر — برای Midjourney / DALL·E / Ideogram */
  imagePrompt: string;
  /** نسبت تصویر پیشنهادی برای جای‌گذاری در اپ */
  imageAspect: number;
  /**
   * وقتی تصویر را ساختی، فایل را در `src/assets/onboarding/{id}.png` بگذار
   * و خط require زیر را در `ONBOARDING_IMAGES` از کامنت دربیاور.
   */
  imageFileName: string;
}

export const ONBOARDING_SLIDES: OnboardingSlideConfig[] = [
  {
    id: 'welcome',
    titleKey: 'welcomeTitle',
    bodyKey: 'welcomeBody',
    kickerKey: 'welcomeKicker',
    accent: '#3BE8C5',
    accentGlow: 'rgba(59,232,197,0.35)',
    imageAspect: 1,
    imageFileName: 'welcome.png',
    imagePrompt:
      'Premium fintech app hero illustration, Persian luxury minimalism, floating glass wallet orbiting golden filaments, deep teal-black gradient background #040608, emerald accent #3BE8C5, soft volumetric glow, 3D isometric, no text, no logos, cinematic lighting, mobile onboarding splash, ultra clean, 4k',
  },
  {
    id: 'auto',
    titleKey: 'autoTitle',
    bodyKey: 'autoBody',
    kickerKey: 'autoKicker',
    accent: '#8B7CFF',
    accentGlow: 'rgba(139,124,255,0.38)',
    imageAspect: 1,
    imageFileName: 'auto.png',
    imagePrompt:
      'Magical automation scene: smartphone with bank SMS notification transforming into organized transaction cards, particle trail emerald to violet, dark UI background, Persian fintech aesthetic, glass morphism cards with income green and expense coral accents, motion blur, no readable text, onboarding illustration, centered composition, 4k',
  },
  {
    id: 'banks',
    titleKey: 'banksTitle',
    bodyKey: 'banksBody',
    kickerKey: 'banksKicker',
    accent: '#D4B483',
    accentGlow: 'rgba(212,180,131,0.35)',
    imageAspect: 1,
    imageFileName: 'banks.png',
    imagePrompt:
      'Fan of premium Iranian bank plastic cards floating in space, each card different jewel-tone gradient (burgundy, navy, forest green, gold trim), unified dark vault background, subtle gold filament lines, no real bank logos, abstract chip and contactless icon, luxury wallet app onboarding, isometric depth, soft reflections, 4k',
  },
  {
    id: 'privacy',
    titleKey: 'smsTitle',
    bodyKey: 'smsBody',
    kickerKey: 'smsKicker',
    accent: '#6EE7B7',
    accentGlow: 'rgba(110,231,183,0.32)',
    imageAspect: 1,
    imageFileName: 'privacy.png',
    imagePrompt:
      'Trust and privacy hero: glowing shield protecting a smartphone, SMS data stays inside device silhouette, lock icon, local processing metaphor, emerald shield on deep black-teal background, calm reassuring mood, Persian fintech, glass shield refraction, no text, onboarding slide, centered, 4k',
  },
];

/**
 * پس از ساخت تصاویر، requireها را فعال کن:
 *
 * welcome: require('../../assets/onboarding/welcome.png'),
 */
export const ONBOARDING_IMAGES: Partial<Record<OnboardingSlideId, ImageSourcePropType>> = {
  // welcome: require('../../assets/onboarding/welcome.png'),
  // auto: require('../../assets/onboarding/auto.png'),
  // banks: require('../../assets/onboarding/banks.png'),
  // privacy: require('../../assets/onboarding/privacy.png'),
};
