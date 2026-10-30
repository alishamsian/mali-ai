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
  // Start closed; LockGate opens automatically only when app lock is disabled.
  vaultUnlocked: false,
  signInLocal: () => set({ signedIn: true, userId: 'local-user', vaultUnlocked: true }),
  signOut: () => set({ signedIn: false, vaultUnlocked: false }),
  lockVault: () => set({ vaultUnlocked: false }),
  unlockVault: () => set({ vaultUnlocked: true }),
}));
