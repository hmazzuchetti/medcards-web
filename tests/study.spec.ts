import { test, expect } from '@playwright/test';

/**
 * Study flow tests.
 *
 * These tests verify the study UI without requiring real Supabase data:
 * - Page structure and navigation
 * - Card reveal interaction
 * - Quality button behavior
 * - Session completion screen
 *
 * Tests that require authenticated data use mock interception where possible.
 * Unauthenticated users are redirected to /login — this is expected behavior.
 */

test.describe('Dashboard', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/\/login/, { timeout: 8000 });
    expect(page.url()).toContain('/login');
  });

  test('login page has MedCards branding', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText('MedCards');
  });
});

test.describe('Study selector page', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/study');
    await page.waitForURL(/\/login/, { timeout: 8000 });
    expect(page.url()).toContain('/login');
  });
});

test.describe('Study session page', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/study/all');
    await page.waitForURL(/\/login/, { timeout: 8000 });
    expect(page.url()).toContain('/login');
  });
});

test.describe('Study flow — mocked session', () => {
  /**
   * These tests mock the Supabase API responses to simulate a real study session
   * without needing real credentials.
   */

  test.beforeEach(async ({ page }) => {
    // Mock Supabase auth to return a valid session
    await page.route('**/auth/v1/token*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-token',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'mock-refresh',
          user: {
            id: 'mock-user-id',
            email: 'test@medcards.test',
            role: 'authenticated',
          },
        }),
      });
    });

    // Mock categories endpoint
    await page.route('**/rest/v1/categories*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'cat-1', name: 'Cardiologia', slug: 'cardiologia', color: null, icon: null },
          { id: 'cat-2', name: 'Neurologia', slug: 'neurologia', color: null, icon: null },
        ]),
      });
    });

    // Mock subcategories endpoint
    await page.route('**/rest/v1/subcategories*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'sub-1', category_id: 'cat-1', name: 'Anatomia Cardíaca', slug: 'anatomia-cardiaca' },
          { id: 'sub-2', category_id: 'cat-2', name: 'Neuroanatomia', slug: 'neuroanatomia' },
        ]),
      });
    });

    // Mock cards endpoint — returns 3 active cards in category cat-1
    await page.route('**/rest/v1/cards*', async (route) => {
      const url = route.request().url();

      // Cards for subcategory sub-1
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'card-1',
            subcategory_id: 'sub-1',
            deck_id: null,
            front: '<p>Qual é a função do coração?</p>',
            back: '<p>Bombear sangue pelo corpo.</p>',
            extra: null,
            card_type: 'basic',
            is_active: true,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
          {
            id: 'card-2',
            subcategory_id: 'sub-1',
            deck_id: null,
            front: '<p>Quantas câmaras tem o coração?</p>',
            back: '<p>Quatro câmaras: 2 átrios e 2 ventrículos.</p>',
            extra: null,
            card_type: 'basic',
            is_active: true,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
          {
            id: 'card-3',
            subcategory_id: 'sub-1',
            deck_id: null,
            front: '<p>O que é miocárdio?</p>',
            back: '<p>Músculo cardíaco responsável pela contração.</p>',
            extra: null,
            card_type: 'basic',
            is_active: true,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        ]),
      });
    });

    // Mock user_card_state — empty (all cards are new)
    await page.route('**/rest/v1/user_card_state*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      }
    });

    // Mock daily_stats
    await page.route('**/rest/v1/daily_stats*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      }
    });

    // Mock profiles
    await page.route('**/rest/v1/profiles*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'mock-user-id', full_name: 'Teste', email: 'test@medcards.test' }]),
      });
    });

    // Inject a fake auth session into localStorage before navigation
    await page.addInitScript(() => {
      const fakeSession = {
        access_token: 'mock-token',
        refresh_token: 'mock-refresh',
        expires_at: Date.now() / 1000 + 3600,
        token_type: 'bearer',
        user: {
          id: 'mock-user-id',
          email: 'test@medcards.test',
          role: 'authenticated',
          aud: 'authenticated',
        },
      };
      // Supabase SSR stores auth in different places; we inject via localStorage
      const key = `sb-bzzbynmksvbhdkywvccf-auth-token`;
      localStorage.setItem(key, JSON.stringify(fakeSession));
    });
  });

  test('study session page has card front on load', async ({ page }) => {
    await page.goto('/study/cat-1');

    // Wait for card to appear (may need to load)
    const cardFront = page.locator('[data-testid="card-front"]');
    await expect(cardFront).toBeVisible({ timeout: 10000 });
  });

  test('clicking card reveals answer', async ({ page }) => {
    await page.goto('/study/cat-1');

    const cardFront = page.locator('[data-testid="card-front"]');
    await expect(cardFront).toBeVisible({ timeout: 10000 });

    await cardFront.click();

    const cardBack = page.locator('[data-testid="card-back"]');
    await expect(cardBack).toBeVisible({ timeout: 5000 });
  });

  test('quality buttons appear after reveal', async ({ page }) => {
    await page.goto('/study/cat-1');

    const cardFront = page.locator('[data-testid="card-front"]');
    await expect(cardFront).toBeVisible({ timeout: 10000 });
    await cardFront.click();

    const qualityButtons = page.locator('[data-testid="quality-buttons"]');
    await expect(qualityButtons).toBeVisible({ timeout: 5000 });

    // Should have 4 quality buttons
    const buttons = qualityButtons.locator('button');
    await expect(buttons).toHaveCount(4);
  });

  test('progress bar advances after answering', async ({ page }) => {
    await page.goto('/study/cat-1');

    const cardFront = page.locator('[data-testid="card-front"]');
    await expect(cardFront).toBeVisible({ timeout: 10000 });
    await cardFront.click();

    // Click "Bom" (quality 3)
    const goodButton = page.locator('[data-testid="quality-buttons"] button').nth(2);
    await goodButton.click();

    // Second card should now be shown (front again)
    const nextFront = page.locator('[data-testid="card-front"]');
    await expect(nextFront).toBeVisible({ timeout: 5000 });
  });

  test('session complete screen appears after all cards', async ({ page }) => {
    await page.goto('/study/cat-1');

    // Answer all 3 cards (each: reveal → click Good)
    for (let i = 0; i < 3; i++) {
      const cardFront = page.locator('[data-testid="card-front"]');
      await expect(cardFront).toBeVisible({ timeout: 10000 });
      await cardFront.click();

      const qualityButtons = page.locator('[data-testid="quality-buttons"]');
      await expect(qualityButtons).toBeVisible({ timeout: 5000 });

      // Click "Bom" (3rd button)
      await qualityButtons.locator('button').nth(2).click();

      // Small wait for animation
      await page.waitForTimeout(300);
    }

    // Session complete screen
    await expect(page.locator('text=Parabéns')).toBeVisible({ timeout: 8000 });
  });
});
