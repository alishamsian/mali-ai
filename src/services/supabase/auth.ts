import { getSupabase } from './client';

export type CloudUser = { id: string; email?: string };

export type AuthResult = { ok: true } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
 * Step 1 of email sign-in: Supabase emails a one-time code. Creates the account on
 * first use. The project's "Magic Link" email template must include {{ .Token }}.
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
      options: { shouldCreateUser: true },
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
