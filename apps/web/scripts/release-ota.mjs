// Publishes the current app-export build as a new OTA release: zips it,
// uploads it to the backend, and the /api/app-updates/latest endpoint starts
// serving it to installed apps on their next launch.
//
// Usage:
//   npm run build:capacitor
//   ADMIN_TOKEN=<jwt for a super_admin/admin user> node scripts/release-ota.mjs <version> [minNativeVersion]
//
// API_BASE_URL and ADMIN_TOKEN come from the environment; version is required.

import { ZipArchive } from 'archiver';
import { createWriteStream, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const [, , version, minNativeVersion] = process.argv;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

if (!version) {
  console.error('Usage: ADMIN_TOKEN=<jwt> node scripts/release-ota.mjs <version> [minNativeVersion]');
  process.exit(1);
}
if (!ADMIN_TOKEN) {
  console.error('Missing ADMIN_TOKEN env var — log in as an admin/super_admin and pass their JWT.');
  process.exit(1);
}

const appExportDir = path.resolve(process.cwd(), 'app-export');
if (!existsSync(appExportDir)) {
  console.error(`${appExportDir} not found — run "npm run build:capacitor" first.`);
  process.exit(1);
}

const tempDir = mkdtempSync(path.join(tmpdir(), 'ota-release-'));
const zipPath = path.join(tempDir, `${version}.zip`);

console.log(`Zipping ${appExportDir} -> ${zipPath}`);
// Built with the `archiver` package rather than PowerShell's Compress-Archive,
// which writes zip entries with backslash path separators on Windows —
// non-compliant with the ZIP spec and unreadable by Android's unzip, so
// nested-folder files (anything under index.html) silently failed to apply.
await new Promise((resolve, reject) => {
  const output = createWriteStream(zipPath);
  const archive = new ZipArchive({ zlib: { level: 9 } });
  output.on('close', resolve);
  archive.on('error', reject);
  archive.pipe(output);
  archive.directory(appExportDir, false);
  archive.finalize();
});

const zipBuffer = readFileSync(zipPath);
const form = new FormData();
form.append('platform', 'android');
form.append('version', version);
if (minNativeVersion) form.append('minNativeVersion', minNativeVersion);
form.append('file', new Blob([zipBuffer], { type: 'application/zip' }), `${version}.zip`);

console.log(`Uploading to ${API_BASE_URL}/api/app-updates ...`);
const res = await fetch(`${API_BASE_URL}/api/app-updates`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
  body: form,
});

rmSync(tempDir, { recursive: true, force: true });

if (!res.ok) {
  console.error(`Upload failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}

const release = await res.json();
console.log(`Published release ${release.version} (checksum ${release.checksum})`);
console.log('Installed apps will pick it up next launch.');
