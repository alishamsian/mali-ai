import { getSupabase } from './client';

export type CloudUser = { id: string; email?: string };

export type AuthResult = { ok: true } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Where the sign-in email link returns; must be in the project's redirect allow-list. */
export const AUTH_REDIRECT_URL = 'poolet://auth';

export function emailLooksValid(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

function failure(error: unknown): AuthResult {
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message: unknown }).message)
      : 'unknown';
  return { ok: false, error: message };
}

/**
 * Step 1 of email sign-in. Supabase emails a sign-in link back to the app
 * (AUTH_REDIRECT_URL), plus a one-time code when the email template includes
 * {{ .Token }} (templates are editable only with custom SMTP on the free plan).
 * Creates the account on first use.
 */
export async function sendEmailCode(email: string): Promise<AuthResult> {
  const client = getSupabase();
  if (!client) {
    return { ok: false, error: 'not-configured' };
  }
  if (!emailLooksValid(email)) {
    return { ok: false, error: 'invalid-email' };
  }
  try {
    const { error } = await client.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true, emailRedirectTo: AUTH_REDIRECT_URL },
    });
    return error ? failure(error) : { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** Step 2: the code from the email. On success the session is stored (encrypted). */
export async function verifyEmailCode(email: string, code: string): Promise<AuthResult> {
  const client = getSupabase();
  if (!client) {
    return { ok: false, error: 'not-configured' };
  }
  const token = code.replace(/\D/g, '');
  if (token.length < 6) {
    return { ok: false, error: 'invalid-code' };
  }
  try {
    const { data, error } = await client.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token,
      type: 'email',
    });
    if (error || !data.session) {
      return failure(error ?? { message: 'no-session' });
    }
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

export function isAuthRedirect(url: string | null | undefined): url is string {
  return Boolean(url && url.startsWith(AUTH_REDIRECT_URL));
}

function urlParams(url: string): Map<string, string> {
  const params = new Map<string, string>();
  // Query (?code=…) and fragment (#error=…) both carry values.
  for (const part of url.split(/[?#]/).slice(1)) {
    for (const pair of part.split('&')) {
      const [key, value = ''] = pair.split('=');
      if (key) {
        params.set(decodeURIComponent(key), decodeURIComponent(value.replace(/\+/g, ' ')));
      }
    }
  }
  return params;
}

/** Finishes sign-in from the email link that reopened the app. */
export async function completeSignInFromUrl(url: string): Promise<AuthResult> {
  const client = getSupabase();
  if (!client) {
    return { ok: false, error: 'not-configured' };
  }
  const params = urlParams(url);
  const linkError = params.get('error_description') ?? params.get('error');
  if (linkError) {
    return { ok: false, error: linkError };
  }
  try {
    const code = params.get('code');
    if (code) {
      const { error } = await client.auth.exchangeCodeForSession(code);
      return error ? failure(error) : { ok: true };
    }
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (accessToken && refreshToken) {
      const { error } = await client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      return error ? failure(error) : { ok: true };
    }
    return { ok: false, error: 'no-code' };
  } catch (error) {
    return failure(error);
  }
}

export async function getCloudUser(): Promise<CloudUser | null> {
  const client = getSupabase();
  if (!client) {
    return null;
  }
  try {
    const { data } = await client.auth.getSession();
    const user = data.session?.user;
    return user ? { id: user.id, email: user.email ?? undefined } : null;
  } catch {
    return null;
  }
}

export async function signOutCloud(): Promise<void> {
  const client = getSupabase();
  if (!client) {
    return;
  }
  try {
    await client.auth.signOut();
  } catch {
    // Local session is cleared by the client even when the network call fails.
  }
}

/** Calls back on sign-in, sign-out and token refresh. Returns an unsubscribe function. */
export function onCloudUserChange(listener: (user: CloudUser | null) => void): () => void {
  const client = getSupabase();
  if (!client) {
    return () => undefined;
  }
  const { data } = client.auth.onAuthStateChange((_event, session) => {
    const user = session?.user;
    listener(user ? { id: user.id, email: user.email ?? undefined } : null);
  });
  return () => data.subscription.unsubscribe();
}
