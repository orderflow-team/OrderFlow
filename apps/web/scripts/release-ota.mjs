// Publishes the current app-export build as a new OTA release: zips it,
// uploads it to the backend, and the /api/app-updates/latest endpoint starts
// serving it to installed apps on their next launch.
//
// Usage:
//   npm run build:capacitor
//   ADMIN_TOKEN=<jwt for a super_admin/admin user> node scripts/release-ota.mjs <version> [minNativeVersion] [platform]
//
// ADMIN_TOKEN comes from the environment and is required. NEXT_PUBLIC_API_URL
// is optional — defaults to the production API, so it only needs setting to
// target a different backend (e.g. local dev).
//
// `platform` defaults to "android", the shared bucket every Android install
// falls back to when nothing more specific has been published (see
// app-updates.service.ts's getLatest — a client polling "android-direct" or
// "android-playstore" falls back to "android" automatically). Leave it at
// the default for a normal release; pass "android-playstore" explicitly only
// when publishing something that should reach *just* Play Store installs
// (e.g. because it must NOT be built with the direct flavor's native-updater
// JS re-enabled — see NEXT_PUBLIC_DISTRIBUTION_CHANNEL in build:capacitor).

import { ZipArchive } from 'archiver';
import { createWriteStream, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const [, , version, minNativeVersion, platform] = process.argv;
// Defaults to the real production API, not localhost — an OTA release always
// ships to installed apps in the field, which only ever poll the production
// backend, so a "local" release target isn't a real use case. Forgetting to
// set NEXT_PUBLIC_API_URL used to mean the upload silently went to
// localhost:4000 (usually nothing listening there) instead of failing loudly
// or doing the right thing by default.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://orderflow-1.onrender.com';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

if (!version) {
  console.error('Usage: ADMIN_TOKEN=<jwt> node scripts/release-ota.mjs <version> [minNativeVersion] [platform]');
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

// Next.js inlines NEXT_PUBLIC_* vars into the compiled JS at build time — if
// app-export was built without NEXT_PUBLIC_API_URL explicitly set to prod,
// it silently falls back to .env.local's http://localhost:3000 (meant for
// local dev only), baking a URL that doesn't exist on any installed device
// into every request the shipped bundle ever makes. This shipped exactly
// that as release 1.0.5 and broke signup/login/OTP for every native user who
// picked up the update. Refuse to upload a bundle with that baked in.
const chunksDir = path.join(appExportDir, '_next', 'static', 'chunks');
if (existsSync(chunksDir)) {
  const offenders = readdirSync(chunksDir)
    .filter((f) => f.endsWith('.js'))
    .filter((f) => readFileSync(path.join(chunksDir, f), 'utf8').includes('localhost:3000'));
  if (offenders.length > 0) {
    console.error(
      `Refusing to publish: ${offenders.length} bundle file(s) reference localhost:3000 — this build was made without NEXT_PUBLIC_API_URL set to prod.\n` +
      `Rebuild with: NEXT_PUBLIC_API_URL=${API_BASE_URL} npm run build:capacitor`,
    );
    process.exit(1);
  }
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
form.append('platform', platform || 'android');
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
console.log(`Published release ${release.version} for platform "${platform || 'android'}" (checksum ${release.checksum})`);
console.log('Installed apps will pick it up next launch.');
