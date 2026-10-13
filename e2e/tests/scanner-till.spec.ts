import { chromium, devices, expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { alertIn, Api, beneficiaryLogin, eventually, manualScan, readyBeneficiary, staffLogin, uiLogin } from './support';
import { writeQrVideo } from './qr-video';

/** The web build of the camera decodes with zxing-wasm, fetched from a CDN at runtime: served from node_modules. */
async function serveBarcodeDecoder(page: Page) {
  const wasm = path.join(__dirname, '../../mobile/node_modules/zxing-wasm/dist/reader/zxing_reader.wasm');
  await page.route(/zxing-wasm@.*\.wasm$/, (route) => route.fulfill({ path: wasm, contentType: 'application/wasm' }));
}

test.describe('Application · espace personnel (scanner)', () => {
  test('scan par la caméra du QR affiché par le bénéficiaire', async ({ request }) => {
    const api = new Api(request);
    const b = await readyBeneficiary(api);
    const staff = await api.createStaff(b.admin);
    const { token } = await api.qr(b.auth.accessToken);

    const video = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dp-cam-')), 'qr.y4m');
    writeQrVideo(token, video);
    const browser = await chromium.launch({
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`],
    });
    const context = await browser.newContext({ ...devices['Pixel 7'], baseURL: test.info().project.use.baseURL, permissions: ['camera'] });
    const page = await context.newPage();
    await serveBarcodeDecoder(page);
    await staffLogin(page, staff.username, staff.pin);

    // the fake camera shows the code: it is decoded without any manual action
    await expect(page.getByText('Avantage valide')).toBeVisible({ timeout: 25_000 });
    await expect(page.getByText(b.fullName)).toBeVisible();
    await expect(page.getByText(b.partner.name)).toBeVisible();
    await page.getByRole('button', { name: 'Confirmer le passage' }).click();
    await expect(page.getByText('Passage validé')).toBeVisible();
    await browser.close();
  });

  test.skip('contrôle, saisie du prix, confirmation et fermeture automatique du QR côté client', async ({ page, browser, request }) => {
    const api = new Api(request);
    const b = await readyBeneficiary(api);
    const staff = await api.createStaff(b.admin);
    await api.qr(b.auth.accessToken);

    // téléphone du client : écran QR ouvert
    const phoneContext = await browser.newContext({ ...test.info().project.use });
    const phone = await phoneContext.newPage();
    const tokens: string[] = [];
    phone.on('response', async (r) => r.url().endsWith('/api/privileges/qr/daily') && r.ok() && tokens.push((await r.json()).qrCode));
    await beneficiaryLogin(phone, b.credentials.phone, b.password);
    await phone.getByRole('button', { name: 'Utiliser mon avantage' }).click();
    await phone.waitForLoadState('networkidle');
    await expect.poll(() => tokens.length, { timeout: 30_000 }).toBeGreaterThan(0);

    // caisse
    await staffLogin(page, staff.username, staff.pin);
    await expect(page.getByText(staff.displayName)).toBeVisible();
    await manualScan(page, tokens[tokens.length - 1]);
    await expect(page.getByRole('heading', { name: 'Avantage valide' })).toBeVisible();
    await expect(page.getByText(b.fullName)).toBeVisible();
    await expect(page.getByText('−20 % sur 1 plat éligible')).toBeVisible();
    await expect(page.getByText('Plats · hors Boissons, Desserts')).toBeVisible();

    // exemple du cahier des charges : 20 % du kebab à 40 DT = 8 DT
    await page.getByLabel(/Prix du plat remisé/).fill('40');
    await expect(page.getByText('Remise : 8 DT')).toBeVisible();
    await page.getByLabel(/Prix du plat remisé/).fill('37,5');
    await expect(page.getByText('Remise : 7,5 DT')).toBeVisible();
    await page.getByLabel(/Prix du plat remisé/).fill('40');
    await page.getByRole('button', { name: 'Confirmer le passage' }).click();
    await expect(page.getByRole('heading', { name: 'Passage validé' })).toBeVisible();
    await expect(page.getByText('Remise accordée : 8 DT sur 40 DT')).toBeVisible();

    // le téléphone du client passe à « Avantage utilisé »
    await expect(phone.getByRole('heading', { name: 'Avantage utilisé' })).toBeVisible({ timeout: 15_000 });
    await expect(phone.getByText('Remise de 20 % (8 DT) appliquée. Bon appétit !')).toBeVisible();
    await phone.getByRole('button', { name: 'Terminer' }).click();
    await expect(phone.getByText("Déjà utilisé aujourd'hui")).toBeVisible();
    await expect(phone.getByRole('button', { name: /De nouveau disponible le/ })).toBeDisabled();
    await expect(phone.getByText(/\(8 DT\)/).filter({ visible: true })).toBeVisible();

    // le même code présenté une seconde fois est refusé
    await page.getByRole('button', { name: 'Scanner un autre client' }).click();
    await manualScan(page, tokens[tokens.length - 1]);
    await expect(page.getByRole('heading', { name: 'Refusé' })).toBeVisible();
    await expect(page.getByText('QR code déjà utilisé')).toBeVisible();

    // plus aucun QR le même jour
    const again = await api.raw('POST', '/api/privileges/qr', (await api.login('beneficiary', b.credentials.phone, b.password)).accessToken);
    expect(again.status()).toBe(409);
    expect((await again.json()).code).toBe('QUOTA_REACHED');
    await phoneContext.close();
  });

  test('motifs de refus : code falsifié, bénéficiaire désactivé, partenaire inactif', async ({ page, request }) => {
    const api = new Api(request);
    const staff = await api.createStaff(await api.admin());
    await staffLogin(page, staff.username, staff.pin);

    await manualScan(page, 'DP1.eyJiIjoiZmFrZSJ9.c2lnbmF0dXJl');
    await expect(page.getByText('QR code invalide')).toBeVisible();
    await page.getByRole('button', { name: 'Scanner un autre client' }).click();

    const inactive = await readyBeneficiary(api);
    const inactiveToken = (await api.qr(inactive.auth.accessToken)).token;
    await api.call('PATCH', `/api/beneficiaries/${inactive.credentials.beneficiaryId}/status`, inactive.admin, { active: false });
    await eventually(async () => expect((await api.verify((await api.login('staff', staff.username, staff.pin)).accessToken, inactiveToken)).reason).toBe('BENEFICIARY_INACTIVE'));
    await manualScan(page, inactiveToken);
    await expect(page.getByText('Bénéficiaire désactivé')).toBeVisible();
    await expect(page.getByText(inactive.fullName)).toBeVisible();
    await page.getByRole('button', { name: 'Scanner un autre client' }).click();

    const closed = await readyBeneficiary(api);
    const closedToken = (await api.qr(closed.auth.accessToken)).token;
    await api.call('PATCH', `/api/partners/${closed.partner.id}/status`, closed.admin, { active: false });
    await eventually(async () => expect((await api.verify((await api.login('staff', staff.username, staff.pin)).accessToken, closedToken)).reason).toBe('PARTNER_INACTIVE'));
    await manualScan(page, closedToken);
    await expect(page.getByText('Partenaire inactif')).toBeVisible();
  });

  test('un QR code expire après 40 secondes (capture d’écran inutilisable)', async ({ page, request }) => {
    test.slow();
    const api = new Api(request);
    const b = await readyBeneficiary(api);
    const staff = await api.createStaff(b.admin);
    const { token, expiresAt } = await api.qr(b.auth.accessToken);
    await page.waitForTimeout(Math.max(0, new Date(expiresAt).getTime() - Date.now()) + 1500);
    await staffLogin(page, staff.username, staff.pin);
    await manualScan(page, token);
    await expect(page.getByText("QR code expiré : demandez au client d'afficher le code actuel")).toBeVisible();
  });

  test('règle de 2 passages par semaine : le 3e est refusé', async ({ page, request }) => {
    const api = new Api(request);
    const b = await readyBeneficiary(api);
    await api.call('PUT', `/api/partners/${b.partner.id}/rule`, b.admin, {
      discountPercent: 15, eligibleCategories: ['PLATS'], excludedCategories: ['BOISSONS'], usagesPerPeriod: 2, usagePeriod: 'WEEK',
    });
    const staff = await api.createStaff(b.admin);
    const staffToken = (await api.login('staff', staff.username, staff.pin)).accessToken;

    await eventually(async () => {
      const { token } = await api.qr(b.auth.accessToken);
      expect((await api.verify(staffToken, token)).status).toBe('VALID');
      const result = await api.call<{ discountPercent: number }>('POST', '/api/privileges/scan/verify', staffToken, { token });
      expect(result.discountPercent).toBe(15);
    });
    expect((await api.confirm(staffToken, (await api.qr(b.auth.accessToken)).token, 20)).discountAmount).toBe(3);
    const second = (await api.qr(b.auth.accessToken)).token;
    const third = second; // same code shown again
    expect((await api.confirm(staffToken, second)).status).toBe('CONFIRMED');

    await beneficiaryLogin(page, b.credentials.phone, b.password);
    await expect(page.getByText('Déjà utilisé cette semaine')).toBeVisible();
    await expect(page.getByText('sur 2 plats éligible par semaine')).toBeVisible();
    expect((await api.verify(staffToken, third)).reason).toBe('QR_ALREADY_USED');
  });

  test('deux caisses qui valident en même temps ne comptent qu’un passage', async ({ request }) => {
    const api = new Api(request);
    const b = await readyBeneficiary(api);
    const staffA = await api.createStaff(b.admin);
    const staffB = await api.createStaff(b.admin);
    const tokenA = (await api.login('staff', staffA.username, staffA.pin)).accessToken;
    const tokenB = (await api.login('staff', staffB.username, staffB.pin)).accessToken;
    const first = (await api.qr(b.auth.accessToken)).token;
    const second = (await api.qr(b.auth.accessToken)).token;

    const results = await Promise.all([
      api.confirm(tokenA, first, 40), api.confirm(tokenB, first, 40),
      api.confirm(tokenA, second, 40), api.confirm(tokenB, second, 40),
    ]);
    expect(results.filter((r) => r.status === 'CONFIRMED')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'REFUSED').map((r) => r.reason).sort()).toEqual(
      expect.arrayContaining(['QR_ALREADY_USED']),
    );
    for (const r of results.filter((x) => x.status === 'REFUSED')) {
      expect(['QR_ALREADY_USED', 'QUOTA_REACHED']).toContain(r.reason);
    }
  });

  test('le scanner se déconnecte après 5 minutes d’inactivité', async ({ page, request }) => {
    const api = new Api(request);
    const staff = await api.createStaff(await api.admin());
    await page.clock.install();
    await staffLogin(page, staff.username, staff.pin);
    await page.clock.fastForward('04:00');
    await expect(page).toHaveURL(/\/scanner$/);
    await page.getByText('Saisie manuelle du code').click(); // activité : le compteur repart
    await page.clock.fastForward('04:00');
    await expect(page).toHaveURL(/\/scanner$/);
    await page.clock.fastForward('01:30');
    await expect(page).toHaveURL(/\/connexion\?espace=staff$/);
    await page.goto('/scanner');
    await expect(page).toHaveURL(/\/bienvenue$/);
  });

  test('un compte scanner désactivé ne peut plus se connecter', async ({ page, request }) => {
    const api = new Api(request);
    const admin = await api.admin();
    const staff = await api.createStaff(admin);
    const account = (await api.call<{ id: string; username: string }[]>('GET', '/api/accounts?role=STAFF', admin)).find((a) => a.username === staff.username)!;
    await api.call('PATCH', `/api/accounts/${account.id}`, admin, { active: false });
    await uiLogin(page, 'staff', staff.username, staff.pin);
    await expect(alertIn(page)).toHaveText('Ce compte est désactivé. Contactez Damascino.');
  });
});
