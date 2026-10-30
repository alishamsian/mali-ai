import { Linking } from 'react-native';
import { env } from '../../app/config/env';
import { APP_VERSION } from '../../app/config/version';
import { appAlert } from '../../components/ui/AppAlert';
import { getStorageDriver } from '../../database/drivers/storageBootstrap';
import { t, interpolate } from '../../i18n';

/** What scripts/publish writes next to the APKs. */
export type UpdateManifest = { versionName: string; url: string; notes?: string };

const LAST_CHECK_KEY = 'mali.update.lastCheck';
const CHECK_EVERY_MS = 12 * 60 * 60 * 1000;
const TIMEOUT_MS = 8000;

/** "1.10.0" > "1.9.3"; anything unparsable is never newer. */
export function isNewerVersion(candidate: string, current: string): boolean {
  const parse = (v: string) => v.split('.').map(n => Number.parseInt(n, 10));
  const a = parse(candidate);
  const b = parse(current);
  if (a.some(Number.isNaN) || b.some(Number.isNaN)) {
    return false;
  }
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) {
      return d > 0;
    }
  }
  return false;
}

function validManifest(value: unknown): value is UpdateManifest {
  const m = value as UpdateManifest | null;
  return Boolean(
    m &&
      typeof m.versionName === 'string' &&
      typeof m.url === 'string' &&
      m.url.startsWith('https://'),
  );
}

/**
 * At most twice a day: reads the release manifest and, when a newer version exists,
 * offers to open its download page. HTTPS only; silent on any failure.
 */
export async function checkForUpdate(now = Date.now()): Promise<void> {
  const url = env.updateManifestUrl;
  if (!url.startsWith('https://')) {
    return;
  }
  const storage = getStorageDriver();
  const last = Number(storage.get(LAST_CHECK_KEY) || 0);
  if (now - last < CHECK_EVERY_MS) {
    return;
  }
  storage.set(LAST_CHECK_KEY, String(now));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    const manifest: unknown = res.ok ? await res.json() : null;
    if (!validManifest(manifest) || !isNewerVersion(manifest.versionName, APP_VERSION)) {
      return;
    }
    const dict = t().update;
    appAlert(
      interpolate(dict.title, { version: manifest.versionName }),
      manifest.notes ?? dict.body,
      [
        { text: dict.download, onPress: () => void Linking.openURL(manifest.url) },
        { text: dict.later, style: 'cancel' },
      ],
    );
  } catch {
    // Offline or blocked: try again at the next check.
  } finally {
    clearTimeout(timer);
  }
}
