/**
 * Which browser origins may call the API (CORS).
 *
 * Requests without an Origin header (server-to-server, curl, native HTTP) are not
 * browser cross-origin requests and are always let through here; they are
 * authenticated like any other request.
 */

/** Exactly the origins the Capacitor Android/iOS WebView presents itself as. */
export const CAPACITOR_ORIGINS = ['https://localhost', 'http://localhost', 'capacitor://localhost'] as const;

/** Local development servers. Never accepted when NODE_ENV=production. */
export const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:4000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
] as const;

export const DEFAULT_ALLOWED_ORIGINS = [
  'https://obix360.com',
  'https://www.obix360.com',
  'https://orderflow-web-git-main-clever-minds1.vercel.app',
  'https://orderflow-web-clever-minds1.vercel.app',
  'https://orderflow-web-iota.vercel.app',
] as const;

export function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) return [...DEFAULT_ALLOWED_ORIGINS];
  const list = raw
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter((o) => o.length > 0);
  // A set-but-empty ALLOWED_ORIGINS must not silently fall back to "everything is fine".
  return list.length > 0 ? list : [...DEFAULT_ALLOWED_ORIGINS];
}

export function isOriginAllowed(
  origin: string | undefined,
  options: { allowedOrigins: string[]; production: boolean },
): boolean {
  if (!origin) return true;
  if ((CAPACITOR_ORIGINS as readonly string[]).includes(origin)) return true;
  if (!options.production && (DEV_ORIGINS as readonly string[]).includes(origin)) return true;
  return options.allowedOrigins.includes(origin);
}
