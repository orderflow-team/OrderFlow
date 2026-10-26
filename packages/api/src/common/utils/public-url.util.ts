import * as path from 'path';

/**
 * Reverse of the above: given a value stored in the database that may be
 * either an absolute URL (uploaded after this fix) or a bare "/uploads/..."
 * path (uploaded before it, back when relative paths were still correct),
 * resolve it to a real path on this server's own disk.
 *
 * The stored value can be client-supplied (it is a plain string column), so the
 * result must stay inside the uploads directory: `/uploads/logos/../../.env`
 * would otherwise point at files outside it, and callers read or delete the
 * resolved path. Throws when it does not.
 */
export function uploadsFilePathFromUrl(url: string): string {
  const pathname = /^https?:\/\//i.test(url) ? new URL(url).pathname : url;
  const uploadsRoot = path.resolve(process.cwd(), 'uploads');
  const resolved = path.resolve(process.cwd(), `.${pathname.startsWith('/') ? '' : '/'}${pathname}`);
  if (!resolved.startsWith(uploadsRoot + path.sep)) {
    throw new Error('Path is outside the uploads directory');
  }
  return resolved;
}
