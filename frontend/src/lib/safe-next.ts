/** Where to go after sign-in when `?next=` is missing or isn't a same-site path. */
export const DEFAULT_NEXT = "/posts";

// Any origin works: it only has to differ from the hosts an attacker could pick.
const PROBE_ORIGIN = "http://probe.invalid";

/**
 * Browsers drop tabs and line breaks from URLs and read a backslash as a slash, so
 * `/\evil.com` and `/<TAB>/evil.com` both end up as `//evil.com` (a different site).
 * Control characters and backslashes have no place in a path we redirect to.
 */
function hasUnsafeCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f || code === 0x5c) return true;
  }
  return false;
}

/**
 * The login page's `?next=` is user-controlled, so only same-site paths are honoured;
 * anything else falls back to `fallback`. This keeps the login page from being used as
 * an open redirect. A valid path is returned unchanged, query string and hash included.
 */
export function safeNext(next: string | undefined, fallback: string = DEFAULT_NEXT): string {
  if (!next || hasUnsafeCharacter(next)) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  try {
    // Parse it the way a browser would and require that it stays on the same origin.
    if (new URL(next, PROBE_ORIGIN).origin !== PROBE_ORIGIN) return fallback;
  } catch {
    return fallback;
  }
  return next;
}
