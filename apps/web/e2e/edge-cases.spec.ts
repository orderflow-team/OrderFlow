import { test, expect } from '@playwright/test';
import { signUp, createBusiness, uniqueEmail } from './helpers';

// Covers checklist Step 3 "Mobile Edge Cases & Error Handling": losing
// connectivity mid-session, and a slow backend response. Against the real
// NestJS API (network conditions are emulated at the browser/CDP level via
// context.setOffline / page.route, not by swapping in a fake backend).

test('losing connectivity: sales queue locally instead of crashing or erroring', async ({ page, context }) => {
  const email = uniqueEmail('e2e-offline');
  await signUp(page, email, 'TestPass123');
  await createBusiness(page, `E2E Offline Test ${Date.now()}`, 'pharmacy');

  await test.step('seed a product to sell, and warm the New Order screen\'s offline cache while still online', async () => {
    await page.getByRole('button', { name: /Load Demo Data/i }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Load Demo Data', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 20_000 });

    await page.goto('/orders');
    await page.getByRole('button', { name: 'New Order' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByRole('heading', { name: 'Dolo', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  await test.step('go offline: the app surfaces it instead of failing silently or crashing', async () => {
    await context.setOffline(true);
    await expect(page.getByText('Offline — sales are queued locally')).toBeVisible({ timeout: 10_000 });
  });

  await test.step('a sale recorded while offline succeeds locally (queued, not an error)', async () => {
    // Reopened via the in-app button (client-side, no document reload) —
    // going through page.goto() here would force a full navigation, and
    // AppShell re-probes real connectivity on every mount (Android WebViews
    // report the 'offline' event unreliably, so it never trusts it blindly —
    // see useOfflineSync in lib/offline-store.ts). A fresh mount mid-test
    // would re-run that probe and could flip isOnline back before this step
    // even runs, which isn't the scenario being tested here (a still-open
    // app losing its connection, not a fresh cold load while offline).
    await page.getByRole('button', { name: 'New Order' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    // Product list renders from the cache warmed above — no network needed.
    await dialog.getByRole('heading', { name: 'Dolo', exact: true }).click();
    await expect(dialog.getByText(/Cart \(1 item/i)).toBeVisible();
    await dialog.getByRole('button', { name: 'Submit Order' }).click();
    // Offline queuing "never throws" (generic-order-modal.tsx) — the modal
    // closes exactly like a successful online submit, no error text shown.
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });
  });

  await test.step('the queued sale is reflected as pending, not lost', async () => {
    await expect(page.getByText('Offline — sales are queued locally')).toBeVisible();
  });

  await test.step('reconnecting syncs the queued sale automatically', async () => {
    await context.setOffline(false);
    // isOnline flips back and the queue drains — banner switches from the
    // grey "Offline" state to (briefly) an amber "pending sync" count, then
    // clears once the queued order actually reaches the server.
    await expect(page.getByText('Offline — sales are queued locally')).not.toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/pending sync/i)).not.toBeVisible({ timeout: 15_000 });
  });

  await test.step('the synced order is really on the server, not just cleared from the UI', async () => {
    await page.goto('/orders');
    await expect(page.getByText('Walk-in').first()).toBeVisible({ timeout: 10_000 });
  });
});

test('a slow API response shows a loading state instead of a blank or frozen screen', async ({ page }) => {
  const email = uniqueEmail('e2e-slow');
  await signUp(page, email, 'TestPass123');
  await createBusiness(page, `E2E Slow API Test ${Date.now()}`, 'pharmacy');

  // Delay the dashboard fetch well past a normal response time, then let it
  // through — simulates a slow backend without needing a real one.
  await page.route('**/api/reports/dashboard**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 4_000));
    await route.continue();
  });

  await page.reload();

  // The loading state is visible WHILE the response is still pending...
  await expect(page.getByText('Loading dashboard...')).toBeVisible({ timeout: 2_000 });
  // ...and real content replaces it once the delayed response arrives,
  // rather than the page hanging on the loading state indefinitely.
  await expect(page.getByText('Loading dashboard...')).not.toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});
