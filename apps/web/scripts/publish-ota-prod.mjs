import { ZipArchive } from 'archiver';
import { createWriteStream, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://orderflow-1.onrender.com';
const version = process.argv[2] || '1.22.0';

async function run() {
  let token = process.env.ADMIN_TOKEN;

  if (!token) {
    const email = process.env.ADMIN_EMAIL || 'admin@orderflow.com';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    console.log(`Logging in as super admin (${email}) to ${API_BASE_URL}...`);
    const loginRes = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const loginData = await loginRes.json();
    token = loginData.access_token;
    if (!token) {
      console.error('Login failed:', loginData);
      process.exit(1);
    }
    console.log('Successfully logged in! Token acquired.');
  } else {
    console.log('Using ADMIN_TOKEN from environment.');
  }

  const appExportDir = path.resolve(process.cwd(), 'app-export');
  if (!existsSync(appExportDir)) {
    console.error(`${appExportDir} not found.`);
    process.exit(1);
  }

  const tempDir = mkdtempSync(path.join(tmpdir(), 'ota-release-'));
  const zipPath = path.join(tempDir, `${version}.zip`);

  console.log(`Zipping ${appExportDir} -> ${zipPath}`);
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
  form.append('notes', 'Mobile top bar subscription badge and user subscription sync fixes');
  form.append('file', new Blob([zipBuffer], { type: 'application/zip' }), `${version}.zip`);

  console.log(`Uploading OTA release ${version} (${(zipBuffer.length / 1024 / 1024).toFixed(1)} MB) to ${API_BASE_URL}/api/app-updates ...`);
  const res = await fetch(`${API_BASE_URL}/api/app-updates`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  rmSync(tempDir, { recursive: true, force: true });

  if (!res.ok) {
    console.error(`Upload failed: ${res.status} ${await res.text()}`);
    process.exit(1);
  }

  const release = await res.json();
  console.log(`Successfully published OTA release ${release.version} for platform "android"!`);
  console.log('Installed Android apps will pick it up on launch.');
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
