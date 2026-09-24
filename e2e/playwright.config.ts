import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests of Damascino Privilèges against a running stack (docker compose up, or Render):
 *   E2E_BASE_URL=http://localhost:3000 npx playwright test
 * The beneficiary and staff journeys drive the mobile app through its web export (npm run build:app), served on
 * E2E_APP_URL (default http://localhost:8095, started automatically).
 * The tests create their own partners, beneficiaries and staff with unique names, so they can run on a
 * database that already contains data.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // the scenarios share the admin account and daily quotas: run them one after the other
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './tests/global-setup.ts',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    locale: 'fr-FR',
    timezoneId: 'Africa/Tunis',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    acceptDownloads: true,
  },
  projects: [
    {
      name: 'desktop',
      testMatch: /(access|admin|pwa|security)-.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1360, height: 900 } },
    },
    {
      name: 'app',
      testMatch: /(beneficiary|scanner)-.*\.spec\.ts/,
      use: { ...devices['Pixel 7'], baseURL: process.env.E2E_APP_URL ?? 'http://localhost:8095' },
    },
  ],
  webServer: process.env.E2E_APP_URL
    ? undefined
    : { command: 'node mobile-web-server.mjs', url: 'http://localhost:8095', reuseExistingServer: true },
});
