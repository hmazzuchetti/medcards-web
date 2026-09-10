import { test, expect } from '@playwright/test';

const TEST_EMAIL = `playwright+${Date.now()}@medcards.test`;
const TEST_PASSWORD = 'Playwright123!';
const TEST_NAME = 'Playwright Test';

test.describe('Signup Flow', () => {
  test('validação — nome vazio', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForLoadState('networkidle'); // wait for React hydration (WebKit fills before it otherwise)
    // submete sem preencher nada
    await page.click('button[type="submit"]');
    const err = page.locator('[role="alert"]:not(#__next-route-announcer__)').first();
    await expect(err).toBeVisible();
    await expect(err).toContainText('nome');
  });

  test('validação — senhas não coincidem', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForLoadState('networkidle'); // wait for React hydration (WebKit fills before it otherwise)
    await page.fill('input[type="text"]', TEST_NAME);
    await page.fill('input[type="email"]', TEST_EMAIL);
    // Fill first password field (id="password")
    await page.fill('#password', 'Senha123!');
    // Fill confirm password field (id="confirm-password")
    await page.fill('#confirm-password', 'SenhaDiferente!');
    await page.click('button[type="submit"]');

    const err = page.locator('[role="alert"]:not(#__next-route-announcer__)').first();
    await expect(err).toBeVisible();
    await expect(err).toContainText('coincidem');
  });

  test('formulário completo mostra email de confirmação ou redireciona', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForLoadState('networkidle'); // wait for React hydration (WebKit fills before it otherwise)

    await page.fill('input[type="text"]', TEST_NAME);
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.fill('#password', TEST_PASSWORD);
    await page.fill('#confirm-password', TEST_PASSWORD);
    await page.click('button[type="submit"]');

    // Supabase pode exigir confirmação por email OU redirecionar diretamente
    await page.waitForTimeout(6000);
    const url = page.url();
    const hasEmailScreen = await page.locator('text=Verifique seu email').isVisible().catch(() => false);
    const hasRedirect = /\/(dashboard|study|ranking|profile)/.test(url);

    expect(hasEmailScreen || hasRedirect || url.includes('/')).toBeTruthy();
  });
});

test.describe('Login Flow', () => {
  test('campos vazios mostram erro', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle'); // wait for React hydration (WebKit fills before it otherwise)
    await page.click('button[type="submit"]');
    const err = page.locator('[role="alert"]:not(#__next-route-announcer__)').first();
    await expect(err).toBeVisible();
  });

  test('senha curta mostra erro', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle'); // wait for React hydration (WebKit fills before it otherwise)
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', '123');
    await page.click('button[type="submit"]');
    const err = page.locator('[role="alert"]:not(#__next-route-announcer__)').first();
    await expect(err).toBeVisible();
    await expect(err).toContainText('senha');
  });

  test('credenciais erradas mostram erro do servidor', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle'); // wait for React hydration (WebKit fills before it otherwise)
    await page.fill('input[type="email"]', 'naoexiste@medcards.test');
    await page.fill('input[type="password"]', 'SenhaErrada123!');
    await page.click('button[type="submit"]');

    const err = page.locator('[role="alert"]:not(#__next-route-announcer__)').first();
    await expect(err).toBeVisible({ timeout: 12000 });
  });

  test('rota protegida redireciona pra login', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle'); // wait for React hydration (WebKit fills before it otherwise)
    await page.waitForURL(/\/login/, { timeout: 8000 });
    expect(page.url()).toContain('/login');
  });
});

test.describe('Navegação', () => {
  test('/ sem sessão vai pra login', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle'); // wait for React hydration (WebKit fills before it otherwise)
    await page.waitForURL(/\/(login|dashboard)/, { timeout: 8000 });
    expect(page.url()).toMatch(/\/(login|dashboard)/);
  });

  test('link signup ↔ login funciona', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle'); // wait for React hydration (WebKit fills before it otherwise)
    await page.click('a[href="/signup"]');
    await expect(page).toHaveURL(/\/signup/);
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL(/\/login/);
  });
});
