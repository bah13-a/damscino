import { defineConfig } from '@playwright/test';

/**
 * Generates the screenshots of the user manual (docs/manuel/img) on a FRESH database:
 *   npx playwright test -c playwright.manual.config.ts
 * The script walks through a realistic scenario (partners, import, first login, QR, till, statistics).
 */
export default defineConfig({
  testDir: './manual',
  timeout: 600_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    locale: 'fr-FR',
    timezoneId: 'Africa/Tunis',
    acceptDownloads: true,
    actionTimeout: 20_000,
  },
});
