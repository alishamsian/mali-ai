import { getSupabase } from '../../services/supabase/client';

/** Product feature gates — hide unfinished surfaces from regular users. */
export const APP_FEATURES = {
  /** Cloud sync UI until Supabase is configured and tested. */
  cloudSync: false,
  devTools: __DEV__,
} as const;

export function isCloudSyncAvailable(): boolean {
  return APP_FEATURES.cloudSync && Boolean(getSupabase());
}
