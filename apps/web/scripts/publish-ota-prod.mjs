import { ZipArchive } from 'archiver';
import { createWriteStream, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://obix360.com';
const version = process.argv[2] || '1.29.0';

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
    console.error(`\n❌ Error: ${appExportDir} not found.`);
    console.error(`Please run: npm run build:capacitor before publishing.\n`);
    process.exit(1);
  }

  // Pre-release validation: Next.js inlines NEXT_PUBLIC_* variables into client chunks.
  // If built without NEXT_PUBLIC_API_URL=https://obix360.com, it inlines localhost or dev proxies,
  // causing "Network error: Unable to connect to server" on mobile devices after OTA update.
  const chunksDir = path.join(appExportDir, '_next', 'static', 'chunks');
  if (existsSync(chunksDir)) {
    const chunkFiles = readdirSync(chunksDir).filter((f) => f.endsWith('.js'));
    const offenders = chunkFiles.filter((f) => {
      const content = readFileSync(path.join(chunksDir, f), 'utf8');
      return content.includes('localhost:3000') || content.includes('localhost:4000') || content.includes('/api-proxy');
    });

    if (offenders.length > 0) {
      console.error(
        `\n❌ BLOCKED RELEASE: ${offenders.length} bundle file(s) reference localhost or /api-proxy!\n` +
        `This will cause mobile app network errors ("Unable to connect to server").\n` +
        `Rebuild properly by running:\n` +
        `  npm run build:capacitor\n`
      );
      process.exit(1);
    }

    const hasProdUrl = chunkFiles.some((f) =>
      readFileSync(path.join(chunksDir, f), 'utf8').includes('https://obix360.com')
    );
    if (!hasProdUrl) {
      console.error(
        `\n❌ BLOCKED RELEASE: No chunks reference production URL (https://obix360.com)!\n` +
        `Please rebuild properly by running:\n` +
        `  npm run build:capacitor\n`
      );
      process.exit(1);
    }
    console.log(`✅ Bundle verified: Production API URL (https://obix360.com) confirmed, 0 localhost leaks.`);
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
  const releaseNotes = process.argv[3] || 'Elevated Quick Order button in floating dock with perfect circular cradle and icon uniformity';
  form.append('notes', releaseNotes);
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
