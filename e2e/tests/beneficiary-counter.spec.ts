import { chromium, devices, expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { adminLogin, Api, beneficiaryLogin, eventually, readyBeneficiary, uid, WEB_URL } from './support';
import { writeQrVideo } from './qr-video';

/** The web build of the camera decodes with zxing-wasm, fetched from a CDN at runtime: served from node_modules. */
async function serveBarcodeDecoder(page: Page) {
  const wasm = path.join(__dirname, '../../mobile/node_modules/zxing-wasm/dist/reader/zxing_reader.wasm');
  await page.route(/zxing-wasm@.*\.wasm$/, (route) => route.fulfill({ path: wasm, contentType: 'application/wasm' }));
}

/** Customer's phone whose camera sees {@code text} (the counter label), signed in to the app. */
async function phoneFacing(text: string, phone: string, password: string) {
  const video = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dp-counter-')), 'qr.y4m');
  writeQrVideo(text, video);
  const browser = await chromium.launch({
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`],
  });
  const context = await browser.newContext({ ...devices['Pixel 7'], baseURL: test.info().project.use.baseURL, permissions: ['camera'] });
  const page = await context.newPage();
  await serveBarcodeDecoder(page);
  await beneficiaryLogin(page, phone, password);
  return { browser, page };
}

test.describe('QR de caisse : le client scanne l’étiquette du comptoir avec l’application', () => {
  test('remise validée une fois, refusée ensuite jusqu’à minuit', async ({ page, request }) => {
    const api = new Api(request);
    const b = await readyBeneficiary(api);
    await api.qr(b.auth.accessToken); // compte connu du service privilèges
    const tillName = `Caisse comptoir ${uid()}`;

    // administration : la caisse et son étiquette à imprimer
    await adminLogin(page);
    await page.goto(`${WEB_URL}/admin/caisses`);
    await page.getByLabel('Nom de la caisse').fill(tillName);
    await page.getByRole('button', { name: 'Ajouter la caisse' }).click();
    await page.getByRole('button', { name: 'Fermer', exact: true }).last().click();
    await page.getByRole('row', { name: new RegExp(tillName) }).getByRole('link', { name: 'QR de caisse' }).click();
    const label = page.getByTestId('counter-label');
    await expect(label).toContainText('Votre avantage Damascino Privilèges');
    await expect(label).toContainText(tillName);
    await expect(page.getByRole('button', { name: 'Imprimer l’étiquette' }).or(page.getByRole('button', { name: "Imprimer l'étiquette" }))).toBeVisible();

    const terminals = await api.call<{ id: string; name: string; counterCode: string }[]>('GET', '/api/pos-terminals', b.admin);
    const terminal = terminals.find((t) => t.name === tillName)!;
    const counterUrl = `${WEB_URL}/comptoir/${terminal.counterCode}`;

    // téléphone du client : « Utiliser mon avantage » ouvre l'appareil photo, qui lit l'étiquette
    const { browser, page: phone } = await phoneFacing(counterUrl, b.credentials.phone, b.password);
    await phone.getByRole('button', { name: 'Utiliser mon avantage' }).click();
    const result = phone.getByTestId('counter-result');
    await expect(result).toContainText('Remise validée', { timeout: 25_000 });
    await expect(result).toContainText('−20 %');
    await expect(result).toContainText('« Damascino Privilèges »');
    await expect(result).toContainText(b.fullName);
    await expect(result).toContainText(tillName);
    const firstTick = await phone.getByTestId('counter-clock').textContent();
    await expect(phone.getByTestId('counter-clock')).not.toHaveText(firstTick!); // horloge vivante (anti-capture d'écran)

    // le passage compte : nouvel essai le même jour refusé
    await phone.getByRole('button', { name: 'Terminer' }).click();
    await expect(phone.getByText(/De nouveau disponible le/)).toBeVisible();
    await browser.close();
    // (nouvelle session : la connexion du téléphone a remplacé celle de la préparation du test)
    const session = await api.login('beneficiary', b.credentials.phone, b.password);
    const again = await api.call<{ status: string; reason: string; message: string }>('POST', `/api/privileges/counter/${terminal.counterCode}/use`, session.accessToken);
    expect(again).toMatchObject({ status: 'REFUSED', reason: 'QUOTA_REACHED', message: 'Avantage déjà utilisé : il sera de nouveau disponible demain.' });

    // l'administration le voit comme un passage « QR de caisse »
    type Usages = { items: { beneficiaryName: string; channel: string; staffName: string }[] };
    const usages = await eventually(async () => {
      const page = await api.call<Usages>('GET', `/api/reporting/usages?partnerId=${b.partner.id}`, b.admin);
      if (page.items.length === 0) throw new Error('passage pas encore projeté');
      return page;
    });
    expect(usages.items).toHaveLength(1);
    expect(usages.items[0]).toMatchObject({ channel: 'COUNTER', staffName: tillName, beneficiaryName: b.fullName });
  });

  test('sans compte, le QR de caisse ne valide rien ; un nouveau QR désactive l’ancienne étiquette', async ({ page, request }) => {
    const api = new Api(request);
    const b = await readyBeneficiary(api);
    await api.qr(b.auth.accessToken);
    const created = await api.call<{ terminal: { id: string; name: string; counterCode: string } }>('POST', '/api/pos-terminals', b.admin, { name: `Caisse ${uid()}` });
    const oldCode = created.terminal.counterCode;

    // appareil photo du téléphone (sans l'application) : page d'explication, aucune validation
    await page.goto(`${WEB_URL}/comptoir/${oldCode}`);
    await expect(page.getByText(created.terminal.name)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Utilisez votre avantage avec l’application' }).or(page.getByRole('heading', { name: "Utilisez votre avantage avec l'application" }))).toBeVisible();
    expect((await api.raw('POST', `/api/privileges/counter/${oldCode}/use`)).status()).toBe(401);
    const staff = await api.createStaff(b.admin);
    const staffToken = (await api.login('staff', staff.username, staff.pin)).accessToken;
    expect((await api.raw('POST', `/api/privileges/counter/${oldCode}/use`, staffToken)).status()).toBe(403);

    // étiquette remplacée : l'ancienne est refusée, la nouvelle fonctionne
    const renewed = await api.call<{ counterCode: string }>('POST', `/api/pos-terminals/${created.terminal.id}/counter-code`, b.admin);
    expect(renewed.counterCode).not.toBe(oldCode);
    expect(await api.call('POST', `/api/privileges/counter/${oldCode}/use`, b.auth.accessToken)).toMatchObject({ status: 'REFUSED', reason: 'COUNTER_UNKNOWN' });
    await page.goto(`${WEB_URL}/comptoir/${oldCode}`);
    await expect(page.getByRole('heading', { name: 'QR code de caisse inconnu' })).toBeVisible();
    expect(await api.call('POST', `/api/privileges/counter/${renewed.counterCode}/use`, b.auth.accessToken)).toMatchObject({ status: 'CONFIRMED' });

    // caisse révoquée : refusée
    await api.call('PATCH', `/api/pos-terminals/${created.terminal.id}/status`, b.admin, { active: false });
    const other = await readyBeneficiary(api);
    await api.qr(other.auth.accessToken);
    expect(await api.call('POST', `/api/privileges/counter/${renewed.counterCode}/use`, other.auth.accessToken)).toMatchObject({ status: 'REFUSED', reason: 'COUNTER_UNKNOWN' });
  });
});
