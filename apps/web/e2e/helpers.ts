import { Page, expect } from '@playwright/test';

// Every spec creates its own fresh business rather than sharing a fixture
// account — signup/business-creation IS part of what Step 2 needs to cover,
// and a unique email per run means specs never collide or depend on
// leftover state from a previous run.
export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

export async function signUp(page: Page, email: string, password: string, fullName = 'E2E Test User') {
  await page.goto('/signup');
  // next dev serves the document immediately but React hydration lands a
  // beat later — a fill() that lands before hydration attaches listeners
  // sets the raw DOM value with no onChange firing, and hydration then syncs
  // the input back to its (still-empty) initial React state, silently
  // discarding the fill. Waiting for hydration to settle before typing
  // avoids that race; asserting the value after typing (rather than relying
  // on fill's own is-empty check beforehand) catches it if it ever recurs.
  await page.waitForLoadState('networkidle');
  const fullNameInput = page.getByPlaceholder('Full name');
  await fullNameInput.fill(fullName);
  await expect(fullNameInput).toHaveValue(fullName);
  const emailInput = page.getByPlaceholder('name@example.com');
  await emailInput.fill(email);
  await expect(emailInput).toHaveValue(email);
  await page.getByPlaceholder('Password (min 6 characters)').fill(password);
  await page.getByRole('button', { name: 'Create Account' }).click();
}

export async function createBusiness(page: Page, businessName: string, category: 'pharmacy' | 'grocery' | 'restaurant' = 'pharmacy') {
  await expect(page.getByRole('heading', { name: 'Choose a business' })).toBeVisible({ timeout: 15_000 });
  await page.getByPlaceholder('Business name').fill(businessName);
  await page.getByPlaceholder('10-digit mobile number').fill('9876543210');
  await page.getByRole('combobox').selectOption(category);
  await page.getByLabel('Enable Inventory module').check();
  await page.getByRole('button', { name: 'Create Business' }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  await dismissTourIfPresent(page);
}

// The very first dashboard visit for a new login auto-opens the onboarding
// tour (AppTour) as a modal — it sits on top of (and ARIA-hides) the rest of
// the page, so anything asserting on dashboard content needs this dismissed
// first or every such assertion times out even though the dashboard rendered
// fine underneath.
export async function dismissTourIfPresent(page: Page) {
  const dialog = page.getByRole('dialog');
  if (await dialog.isVisible({ timeout: 3_000 }).catch(() => false)) {
    // Not a click on the dialog's own [x] — the tour spotlights each home
    // tile behind an absolutely-positioned "Next" hit-zone that overlaps and
    // intercepts pointer events meant for the close button. Escape isn't
    // blocked by that overlay and Radix dialogs close on it by default.
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    // The dialog closing visually and the "seen" flag actually landing in
    // localStorage (AppTour's closeTour, fired from Radix's onOpenChange)
    // aren't necessarily the same tick — a reload() immediately after this
    // call can otherwise occasionally race it and see the tour reopen on
    // the fresh mount. Wait for the write itself, not just the animation.
    await expect
      .poll(() =>
        page.evaluate(() =>
          Object.keys(localStorage).some((k) => k.startsWith('obix_tour_seen_')),
        ),
      )
      .toBe(true);
  }
}

export async function logIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle'); // see signUp() for why
  const emailInput = page.getByPlaceholder('name@example.com');
  await emailInput.fill(email);
  await expect(emailInput).toHaveValue(email);
  await page.getByPlaceholder('••••••••').fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
}

export async function logOut(page: Page) {
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
}
