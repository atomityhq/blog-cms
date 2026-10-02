/**
 * Session cookie shared by proxy.ts (the route gate) and the auth route handlers.
 *
 * Mockup: the value is a placeholder. Once the backend's login endpoint exists it
 * becomes the JWT the backend issues — still httpOnly, so client code never sees it.
 */
export const SESSION_COOKIE = "blogcrm_session";

/** Matches the backend token lifetime (8h). */
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

/** Routes reachable without a session. */
export const PUBLIC_PATHS = ["/login"];
