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
  s = s.replace(/[\s\-_.()]/g, '');
  const international = /^(\+|00)/.test(s);
  s = s.replace(/^\+/, '').replace(/^00/, '');
  // «+98 9830009417», «0098 9121234567» and «09121234567» are the same senders as
  // «9830009417» and «9121234567». Only a real country prefix (12+ digits after it)
  // is stripped, so short codes that merely start with 98 stay intact.
  if (international && /^98\d{10,}$/.test(s)) {
    s = s.slice(2);
  } else if (/^09\d{9}$/.test(s)) {
    s = s.slice(1);
  }
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
  // A verified short code inside a longer incoming address (+98…9830009417), or a full
  // number saved before country prefixes were stripped («989830009417») containing the
  // incoming one. Seven digits minimum keeps «983000» from matching «9830009417».
  return (
    (nv.length >= 4 && ni.includes(nv) && ni.length > nv.length) ||
    (ni.length >= 7 && nv.includes(ni) && nv.length > ni.length)
  );
}
