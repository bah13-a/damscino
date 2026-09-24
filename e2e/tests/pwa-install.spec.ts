import { expect, test } from '@playwright/test';

test.describe('PWA et affichage mobile', () => {
  test('manifeste, icônes et service worker', async ({ page, request }) => {
    const manifest = await (await request.get('/manifest.webmanifest')).json();
    expect(manifest).toMatchObject({ name: 'Damascino Privilèges', display: 'standalone', start_url: '/', lang: 'fr' });
    for (const icon of manifest.icons) {
      expect((await request.get(icon.src)).status(), icon.src).toBe(200);
    }
    expect((await request.get('/icons/apple-touch-icon.png')).status()).toBe(200);
    expect((await request.get('/sw.js')).headers()['cache-control']).toContain('no-cache');

    await page.goto('/');
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest');
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#7a1f2b');
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/icons/apple-touch-icon.png');
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
    expect(scope).toMatch(/\/$/);
  });

  test('page hors ligne pré-chargée par le service worker', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(async () => navigator.serviceWorker.ready);
    await page.reload();
    expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    // Playwright cannot put the service worker itself offline: check the precache it serves on network failure
    const cached = await page.evaluate(async () => (await (await caches.open('dp-shell-v1')).keys()).map((r) => new URL(r.url).pathname));
    expect(cached).toEqual(expect.arrayContaining(['/hors-ligne', '/manifest.webmanifest', '/icons/icon-192.png']));
    await page.goto('/hors-ligne');
    await expect(page.getByRole('heading', { name: 'Vous êtes hors ligne' })).toBeVisible();
  });

  test("aucun défilement horizontal sur un petit téléphone (360 px)", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    for (const path of ['/', '/connexion', '/personnel', '/admin/connexion', '/hors-ligne']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});
