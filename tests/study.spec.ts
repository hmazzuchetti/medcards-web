import { test, expect } from '@playwright/test';

/**
 * Study routes without a session: everything must redirect to /login.
 * The real study flow (with Supabase) lives in tests/e2e/full-flow.spec.ts.
 */

test.describe('Study routes are protected', () => {
  for (const path of ['/', '/study', '/study/all', '/study/folder/abc', '/decks', '/search', '/ranking', '/profile']) {
    test(`${path} redirects unauthenticated users to login`, async ({ page }) => {
      await page.goto(path);
      await page.waitForURL(/\/login/, { timeout: 15_000 });
      expect(page.url()).toContain('/login');
    });
  }

  test('login page has MedCards branding', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText('MedCards');
  });
});
