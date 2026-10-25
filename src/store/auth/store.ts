import { create } from 'zustand';

interface AuthState {
  userId: string;
  signedIn: boolean;
  vaultUnlocked: boolean;
  signInLocal: () => void;
  signOut: () => void;
  lockVault: () => void;
  unlockVault: () => void;
}

export const useAuthStore = create<AuthState>(set => ({
  userId: 'local-user',
  signedIn: true,
  // باز به‌صورت پیش‌فرض — قفل فقط وقتی appLockEnabled و PIN فعال است
  vaultUnlocked: true,
  signInLocal: () => set({ signedIn: true, userId: 'local-user', vaultUnlocked: true }),
  signOut: () => set({ signedIn: false, vaultUnlocked: false }),
  lockVault: () => set({ vaultUnlocked: false }),
  unlockVault: () => set({ vaultUnlocked: true }),
}));
