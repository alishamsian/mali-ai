import { env } from '../../app/config/env';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getStorageDriver } from '../../database/drivers/storageBootstrap';

let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    env.supabaseUrl && env.supabaseAnonKey && !env.supabaseUrl.includes('your-project'),
  );
}

const SESSION_PREFIX = 'mali.supabase.';

/**
 * Keeps the Supabase session (refresh token) in the encrypted store. The default would be
 * browser localStorage, which React Native does not have, so sessions were never kept.
 */
const encryptedSessionStorage = {
  getItem(key: string): string | null {
    try {
      return getStorageDriver().get(SESSION_PREFIX + key) || null;
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      getStorageDriver().set(SESSION_PREFIX + key, value);
    } catch {
      // Store not open yet: the session lasts until the app closes.
    }
  },
  removeItem(key: string): void {
    try {
      getStorageDriver().set(SESSION_PREFIX + key, '');
    } catch {
      // nothing stored
    }
  },
};

/** React Native has no page visibility: refresh tokens only while the app is in front. */
export function setCloudAutoRefresh(active: boolean): void {
  const c = getSupabase();
  if (!c) {
    return;
  }
  if (active) {
    void c.auth.startAutoRefresh();
  } else {
    void c.auth.stopAutoRefresh();
  }
}

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        storage: encryptedSessionStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
