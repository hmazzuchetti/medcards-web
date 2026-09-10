import { test, expect } from '@playwright/test';

test.describe('Auth — Login page', () => {
  test('has login form with email and password fields', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle'); // wait for React hydration (WebKit fills before it otherwise)

    // Check page title / logo
    await expect(page.locator('h1')).toContainText('MedCards');

    // Email field
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();

    // Password field
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();

    // Submit button
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toContainText('Entrar');
  });

  test('shows validation error for empty email', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle'); // wait for React hydration (WebKit fills before it otherwise)

    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    const errorMessage = page.locator('[role="alert"]:not(#__next-route-announcer__)').first();
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('email');
  });

  test('shows validation error for short password', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle'); // wait for React hydration (WebKit fills before it otherwise)

    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', '123');

    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    const errorMessage = page.locator('[role="alert"]:not(#__next-route-announcer__)').first();
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toContainText('senha');
  });

  test('has link to signup page', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle'); // wait for React hydration (WebKit fills before it otherwise)

    const signupLink = page.locator('a[href="/signup"]');
    await expect(signupLink).toBeVisible();
  });
});

test.describe('Auth — Signup page', () => {
  test('has signup form with all required fields', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForLoadState('networkidle'); // wait for React hydration (WebKit fills before it otherwise)

    // Check page title
    await expect(page.locator('h1')).toContainText('MedCards');

    // Full name field
    const nameInput = page.locator('input[type="text"]');
    await expect(nameInput).toBeVisible();

    // Email field
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();

    // Submit button
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toContainText('Criar conta');
  });

  test('has link back to login page', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForLoadState('networkidle'); // wait for React hydration (WebKit fills before it otherwise)

    const loginLink = page.locator('a[href="/login"]');
    await expect(loginLink).toBeVisible();
  });
});
