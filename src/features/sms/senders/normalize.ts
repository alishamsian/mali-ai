/**
 * Canonical SMS sender normalization — use before compare/store.
 * Strips whitespace, leading +, and Persian/Arabic digits → ASCII.
 */
export function normalizeSmsSender(raw: string | null | undefined): string {
  if (!raw) {
    return '';
  }
  let s = raw.trim().toLowerCase();
  s = s.replace(/[\u200e\u200f\u202a-\u202e]/g, '');
  s = s.replace(/[\u06F0-\u06F9]/g, d => String(d.charCodeAt(0) - 0x06f0));
  s = s.replace(/[\u0660-\u0669]/g, d => String(d.charCodeAt(0) - 0x0660));
  s = s.replace(/^\+/, '');
  s = s.replace(/^00/, '');
  s = s.replace(/[\s\-_.]/g, '');
  return s;
}

/** Exact equality after normalize — use when storing / deduping verified senders. */
export function sendersEqual(a: string, b: string): boolean {
  const na = normalizeSmsSender(a);
  const nb = normalizeSmsSender(b);
  return Boolean(na) && na === nb;
}

/**
 * Match an incoming SMS address against a stored verified sender.
 * Allows longer addresses that embed the short code (e.g. +98…9830009417),
 * but does NOT treat "983000" as equal to "9830009417".
 */
export function sendersMatch(incoming: string, verified: string): boolean {
  const ni = normalizeSmsSender(incoming);
  const nv = normalizeSmsSender(verified);
  if (!ni || !nv) {
    return false;
  }
  if (ni === nv) {
    return true;
  }
  // Only allow verified short-code as a substring of the *incoming* address
  return nv.length >= 4 && ni.includes(nv) && ni.length > nv.length;
}
