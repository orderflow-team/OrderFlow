import { test, expect } from '@playwright/test';
import { signUp, createBusiness, logIn, logOut, uniqueEmail } from './helpers';

// Covers checklist Step 2 "Authentication": registration, login, and
// token-refresh handling — against the real NestJS API, no mocking of auth
// itself (only the forced-401 in the refresh test below, which exercises
// the client's interceptor rather than the server).

test('registration, logout, and re-login', async ({ page }) => {
  const email = uniqueEmail('e2e-auth');
  const password = 'TestPass123';

  await test.step('sign up', async () => {
    await signUp(page, email, password);
  });

  await test.step('create a business and land on the dashboard', async () => {
    await createBusiness(page, `E2E Auth Test ${Date.now()}`);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  await test.step('log out returns to the login screen', async () => {
    await logOut(page);
  });

  await test.step('logging back in with the same credentials reaches the dashboard again', async () => {
    await logIn(page, email, password);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });
});

test('rejects login with a wrong password', async ({ page }) => {
  const email = uniqueEmail('e2e-badpw');
  await signUp(page, email, 'TestPass123');
  await createBusiness(page, `E2E BadPW Test ${Date.now()}`);
  await logOut(page);

  await logIn(page, email, 'TotallyWrongPassword');
  // Never leaves the login screen, and never plants a token.
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText(/invalid|incorrect|not found/i)).toBeVisible({ timeout: 10_000 });
  const token = await page.evaluate(() => localStorage.getItem('access_token'));
  expect(token).toBeNull();
});

test('a transient 401 triggers a silent token refresh instead of logging the user out', async ({ page }) => {
  const email = uniqueEmail('e2e-refresh');
  await signUp(page, email, 'TestPass123');
  await createBusiness(page, `E2E Refresh Test ${Date.now()}`);
  await expect(page).toHaveURL(/\/dashboard/);

  // Force exactly one 401 on the next dashboard fetch — everything else
  // (including the real POST /auth/refresh) passes through untouched, so
  // this exercises api-client.ts's actual retry-after-refresh logic rather
  // than faking the whole auth flow.
  let refreshCalled = false;
  let forcedOnce = false;
  await page.route('**/auth/refresh', async (route) => {
    refreshCalled = true;
    await route.continue();
  });
  await page.route('**/api/reports/dashboard**', async (route) => {
    if (!forcedOnce) {
      forcedOnce = true;
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ message: 'Unauthorized' }) });
    } else {
      await route.continue();
    }
  });

  await page.reload();

  // Recovers transparently: still on /dashboard, real content rendered, no
  // "offline, showing stale data" banner (that only appears if the retried
  // request never succeeded and the page fell back to its IndexedDB cache).
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText(/you're offline/i)).not.toBeVisible();
  expect(refreshCalled).toBe(true);
});
