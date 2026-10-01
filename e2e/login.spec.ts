import { test, expect } from '@playwright/test';

test('has login form', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h2', { hasText: 'Iniciar Sesión' })).toBeVisible();
});
