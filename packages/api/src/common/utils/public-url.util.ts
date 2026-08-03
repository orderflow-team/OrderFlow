import * as path from 'path';

/**
 * Base URL other services (the web app, WhatsApp, a browser <img>/<embed> tag)
 * can use to reach files this backend serves from /uploads. A bare relative
 * path like "/uploads/x.pdf" only worked because the web app used to run a
 * Next.js server-side rewrite proxying /uploads/* to this backend — now that
 * it's a static export with no server of its own, a relative path 404s
 * against whatever static host is serving the page. Render sets
 * RENDER_EXTERNAL_URL automatically for every web service.
 */
export function getPublicBaseUrl(): string {
  return process.env.RENDER_EXTERNAL_URL || process.env.API_URL || 'http://localhost:4000';
}

/**
 * Reverse of the above: given a value stored in the database that may be
 * either an absolute URL (uploaded after this fix) or a bare "/uploads/..."
 * path (uploaded before it, back when relative paths were still correct),
 * resolve it to a real path on this server's own disk.
 */
export function uploadsFilePathFromUrl(url: string): string {
  const pathname = /^https?:\/\//i.test(url) ? new URL(url).pathname : url;
  return path.join(process.cwd(), pathname);
}
