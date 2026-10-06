/**
 * Port the API listens on.
 *
 * Production sits behind an Apache reverse proxy that forwards /api/ and /auth/
 * to 127.0.0.1:3001. The old fallback was always 4000 (the local-dev port), so
 * a restart that lost `PORT` from the environment left the API listening on a
 * port nothing proxies to — Apache answered 503 for every API call while the
 * website, a separate process, kept working.
 *
 * `PORT` still wins when set. Without it, production falls back to the port the
 * proxy expects; everything else keeps 4000 so local dev and the README are
 * unchanged.
 */
export const PRODUCTION_DEFAULT_PORT = 3001;
export const DEV_DEFAULT_PORT = 4000;

export interface ResolvedPort {
  port: number;
  /** True when PORT was missing/invalid and a default was used. */
  usedDefault: boolean;
}

export const resolveListenPort = (env: NodeJS.ProcessEnv = process.env): ResolvedPort => {
  const raw = env.PORT?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  if (Number.isInteger(parsed) && parsed > 0 && parsed < 65536) {
    return { port: parsed, usedDefault: false };
  }
  return {
    port: env.NODE_ENV === 'production' ? PRODUCTION_DEFAULT_PORT : DEV_DEFAULT_PORT,
    usedDefault: true,
  };
};
