import * as path from 'path';

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
