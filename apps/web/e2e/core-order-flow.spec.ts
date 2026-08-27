import { test, expect } from '@playwright/test';
import { signUp, createBusiness, uniqueEmail } from './helpers';

// Covers checklist Step 2 "Primary Business Logic" — this app's equivalent
// of "add to cart and checkout" is recording a POS sale: add a product to
// the order cart, submit it, and confirm it lands in the orders list. Runs
// against the real NestJS API.

test('create a new order end-to-end (add product, submit, appears in list)', async ({ page }) => {
  const email = uniqueEmail('e2e-order');
  await signUp(page, email, 'TestPass123');
  await createBusiness(page, `E2E Order Test ${Date.now()}`, 'pharmacy');
  await expect(page).toHaveURL(/\/dashboard/);

  await test.step('seed demo catalog/customers via the real Load Demo Data flow', async () => {
    await page.getByRole('button', { name: /Load Demo Data/i }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Load Demo Data', exact: true }).click();
    // The dialog closes once the seed request resolves.
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 20_000 });
  });

  await test.step('open New Order and add a product to the cart', async () => {
    await page.goto('/orders?new=1');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    // "Dolo" is part of the seeded pharmacy demo catalog.
    await dialog.getByRole('heading', { name: 'Dolo', exact: true }).click();
    await expect(dialog.getByText(/Cart \(1 item/i)).toBeVisible();
  });

  await test.step('submit the order', async () => {
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Submit Order' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 15_000 });
  });

  await test.step('the new order appears in the orders list', async () => {
    // A freshly-submitted walk-in order shows up as the newest row.
    await expect(page.getByText('Walk-in').first()).toBeVisible({ timeout: 10_000 });
  });
});
