/**
 * Fetch محدود به هاست‌های مجاز — لایهٔ دوم در کنار pinning اندروید.
 */

const ALLOWED_HOSTS = new Set([
  'call1.tgju.org',
  'api.coingecko.com',
  'raw.githubusercontent.com',
]);

const MAX_JSON_BYTES = 2_000_000;

function parseHttpsHost(url: string): string {
  const match = url.match(/^https:\/\/([^/?#]+)/i);
  if (!match) {
    throw new Error('https_required');
  }
  return match[1].split(':')[0].toLowerCase();
}

export function assertAllowedMarketUrl(url: string): void {
  const hostname = parseHttpsHost(url);
  if (!ALLOWED_HOSTS.has(hostname)) {
    throw new Error('host_not_allowed');
  }
}

export async function secureMarketFetchJson(url: string, ms = 12_000): Promise<unknown> {
  assertAllowedMarketUrl(url);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'MaliAI/0.1 (finance; local)',
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const text = await res.text();
    if (text.length > MAX_JSON_BYTES) {
      throw new Error('response_too_large');
    }
    return JSON.parse(text) as unknown;
  } finally {
    clearTimeout(timer);
  }
}
