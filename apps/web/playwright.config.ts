import { defineConfig, devices } from '@playwright/test';

// E2E smoke suite for the pre-flight Play Store checklist. Runs against the
// real Next.js dev server + real NestJS API (no mocking) — this is the same
// web bundle the Capacitor WebView loads, so a pass here exercises the exact
// code the Android app ships.
//
// Both servers must already be running before `npm run test:e2e`:
//   apps/web:     npm run dev            (port 3001)
//   packages/api: npm run start:dev      (port 3000)
// This config deliberately does NOT manage either server itself — `nest
// start --watch` has shown flaky first-boot behavior in some environments
// (see project notes), so auto-spawning it from here would make failures
// here indistinguishable from a genuine test regression.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3001',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
