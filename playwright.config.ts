import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';

// Make NEXT_PUBLIC_SUPABASE_* available to tests that talk to Supabase directly
loadEnv({ path: '.env.local' });

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:3000',
    actionTimeout: 15_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Pure unit tests (no browser): scheduler, queue logic
    {
      name: 'unit',
      testMatch: /tests\/unit\/.*\.spec\.ts/,
    },
    // UI tests (auth pages, mocked study flow)
    {
      name: 'Mobile Chrome',
      testMatch: /tests\/[^/]+\.spec\.ts/,
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      testMatch: /tests\/[^/]+\.spec\.ts/,
      use: { ...devices['iPhone 12'] },
    },
    // End-to-end against the real Supabase project (creates a throwaway user)
    {
      name: 'e2e',
      testMatch: /tests\/e2e\/.*\.spec\.ts/,
      use: { ...devices['Pixel 5'] },
      fullyParallel: false,
      workers: 1,
      timeout: 180_000,
    },
    // Demo recording with cursor + captions (only when DEMO=1): npm run demo
    ...(process.env.DEMO
      ? [
          {
            name: 'demo',
            testMatch: /tests\/demo\/.*\.spec\.ts/,
            use: {
              ...devices['Pixel 5'],
              video: { mode: 'on' as const, size: { width: 393, height: 851 } },
            },
            workers: 1,
            timeout: 600_000,
          },
        ]
      : []),
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/login',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
