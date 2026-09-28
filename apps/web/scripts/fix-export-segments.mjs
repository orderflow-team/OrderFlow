// Flattens Next's per-segment RSC payload files in the static export.
//
// The client requests a segment's payload as `__next${segmentPath with "/"
// replaced by "."}.txt` — e.g. `dashboard/__next.dashboard.__PAGE__.txt`.
// Building on Windows, Next 16 instead writes the "/" as a real directory
// (`dashboard/__next.dashboard/__PAGE__.txt`), so every client-side
// navigation in the Capacitor app fetches a file that doesn't exist and
// crashes with "A server error occurred. Reload to try again." OTA 1.31.0 and
// 1.32.0 shipped that way. Linux builds (CI, the VPS) already come out flat,
// so this is a no-op there.
//
// Usage: node scripts/fix-export-segments.mjs [exportDir=app-export]

import { readdirSync, renameSync, rmdirSync, statSync } from 'node:fs';
import path from 'node:path';

const exportDir = path.resolve(process.cwd(), process.argv[2] || 'app-export');

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

/** Directories named `__next.*` are the mis-written segment paths. */
export function flattenedPath(relPath) {
  const parts = relPath.split(/[\\/]/);
  const i = parts.findIndex((p, idx) => p.startsWith('__next.') && idx < parts.length - 1);
  if (i === -1) return null;
  return path.join(...parts.slice(0, i), parts.slice(i).join('.'));
}

function removeEmptyDirs(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) removeEmptyDirs(path.join(dir, entry.name));
  }
  if (dir !== exportDir && readdirSync(dir).length === 0) rmdirSync(dir);
}

let moved = 0;
for (const file of walk(exportDir)) {
  const target = flattenedPath(path.relative(exportDir, file));
  if (!target) continue;
  const dest = path.join(exportDir, target);
  try {
    statSync(dest);
    throw new Error(`Refusing to overwrite existing ${target}`);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  renameSync(file, dest);
  moved++;
}
removeEmptyDirs(exportDir);

console.log(`fix-export-segments: flattened ${moved} segment payload file(s) in ${exportDir}`);
