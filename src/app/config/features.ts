import { isSupabaseConfigured } from '../../services/supabase/client';

/** Product feature gates — hide unfinished surfaces from regular users. */
export const APP_FEATURES = {
  /** Cloud sync UI; it still only appears once .env has the Supabase URL and anon key. */
  cloudSync: true,
  devTools: __DEV__,
} as const;

export function isCloudSyncAvailable(): boolean {
  return APP_FEATURES.cloudSync && isSupabaseConfigured();
}
