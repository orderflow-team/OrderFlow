// Publishes a built, release-signed APK: uploads it to the backend, and the
// /api/app-apk-releases/latest endpoint starts serving it to the in-app
// updater (Settings > About > "Update available").
//
// Usage:
//   ./android/gradlew.bat -p android assembleRelease
//   ADMIN_TOKEN=<jwt for a super_admin/admin user> node scripts/release-apk.mjs <versionName> <apkPath> [notes]
//
// API_BASE_URL and ADMIN_TOKEN come from the environment; versionName and
// apkPath are required. versionName must match android/app/build.gradle's
// versionName for this build — it's what the in-app "newer version?" check
// compares against, Android's own versionCode is what actually gates the
// install itself.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const [, , versionName, apkPathArg, notes] = process.argv;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

if (!versionName || !apkPathArg) {
  console.error('Usage: ADMIN_TOKEN=<jwt> node scripts/release-apk.mjs <versionName> <apkPath> [notes]');
  process.exit(1);
}
if (!ADMIN_TOKEN) {
  console.error('Missing ADMIN_TOKEN env var — log in as an admin/super_admin and pass their JWT.');
  process.exit(1);
}

const apkPath = path.resolve(process.cwd(), apkPathArg);
if (!existsSync(apkPath)) {
  console.error(`${apkPath} not found — build it first (gradlew assembleRelease).`);
  process.exit(1);
}

const apkBuffer = readFileSync(apkPath);
const form = new FormData();
form.append('platform', 'android');
form.append('versionName', versionName);
if (notes) form.append('notes', notes);
form.append('file', new Blob([apkBuffer], { type: 'application/vnd.android.package-archive' }), `obix-${versionName}.apk`);

console.log(`Uploading ${apkPath} (${(apkBuffer.length / 1024 / 1024).toFixed(1)} MB) to ${API_BASE_URL}/api/app-apk-releases ...`);
const res = await fetch(`${API_BASE_URL}/api/app-apk-releases`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
  body: form,
});

if (!res.ok) {
  console.error(`Upload failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}

const release = await res.json();
console.log(`Published APK release ${release.version_name} (checksum ${release.checksum})`);
console.log('Installed apps will see "Update available" in Settings on their next check.');
