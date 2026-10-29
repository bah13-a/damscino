import { expect, test } from '@playwright/test';
import { adminLogin, Api, readyBeneficiary, uid, WEB_URL } from './support';

test.describe('Poste douchette (PC de caisse sans téléphone)', () => {
  test('configuré depuis l’administration, il valide les QR codes lus par la douchette', async ({ page, browser, request }) => {
    const api = new Api(request);
    const b = await readyBeneficiary(api);
    const tillName = `Caisse douchette ${uid()}`;

    // administration : la caisse et le lien de son poste douchette
    await adminLogin(page);
    await page.goto('/admin/caisses');
    await page.getByLabel('Nom de la caisse').fill(tillName);
    await page.getByRole('button', { name: 'Ajouter la caisse' }).click();
    await page.getByText('Autres branchements').click();
    const link = (await page.getByTestId('station-link').textContent())!;
    expect(link).toMatch(/\/douchette#cle=/);

    // PC de caisse : le lien est ouvert une fois, la clé quitte la barre d'adresse
    const station = await (await browser.newContext()).newPage();
    await station.goto(link);
    await expect(station.getByTestId('douchette-station')).toHaveText(tillName);
    expect(station.url()).not.toContain('cle=');
    await station.getByLabel('Caissier (facultatif)').fill('Sami');
    await station.getByLabel('Caissier (facultatif)').press('Enter');

    // la douchette « tape » le code (sans Entrée) : passage validé
    const { token } = await api.qr(b.auth.accessToken);
    await expect(station.getByLabel('Code lu par la douchette')).toBeFocused();
    await station.keyboard.type(token, { delay: 1 });
    const result = station.getByTestId('douchette-result');
    await expect(result).toContainText('Avantage valide');
    await expect(result).toContainText('« Damascino Privilèges » : 20 % sur un plat');
    await expect(result).toContainText(b.fullName);
    await expect(result).toContainText(/Code à noter sur le ticket : \d{6}/);

    // le client le voit dans son espace
    const me = await api.call<{ availability: string; lastScan: { status: string; staffName: string } | null }>(
      'GET', '/api/privileges/me', b.auth.accessToken);
    expect(me).toMatchObject({ availability: 'USED', lastScan: { status: 'CONFIRMED', staffName: `${tillName} · Sami` } });

    // même code rescanné (avec Entrée) : refusé
    await station.keyboard.type(token, { delay: 1 });
    await station.keyboard.press('Enter');
    await expect(result).toContainText('Refusé');
    await expect(result).toContainText('QR code déjà utilisé');
    await expect(station.getByText('Scans précédents')).toBeVisible();

    // lecture incomplète ou autre code-barres suivi d'Entrée : refusé, rien n'est validé
    await station.keyboard.type('3017620422003');
    await station.keyboard.press('Enter');
    await expect(result).toContainText('QR code invalide');
    await expect(station.getByLabel('Code lu par la douchette')).toHaveValue('');

    // le poste reste configuré après rechargement, jusqu'à la révocation de la caisse
    await station.reload();
    await expect(station.getByTestId('douchette-station')).toHaveText(tillName);
    const admin = await api.admin();
    const terminals = await api.call<{ id: string; name: string }[]>('GET', '/api/pos-terminals', admin);
    const terminal = terminals.find((t) => t.name === tillName)!;
    await api.call('PATCH', `/api/pos-terminals/${terminal.id}/status`, admin, { active: false });
    await station.reload();
    await expect(station.getByText(/Ce poste n’est plus autorisé/)).toBeVisible();
  });

  test('sans lien, le poste explique comment le configurer', async ({ page }) => {
    await page.goto('/douchette');
    await expect(page.getByRole('heading', { name: 'Poste non configuré' })).toBeVisible();
  });

  test('douchette réseau : l’adresse donnée par l’administration valide le QR code, quel que soit le format d’envoi', async ({ page, request }) => {
    const api = new Api(request);
    const tillName = `Douchette Wi-Fi ${uid()}`;
    await adminLogin(page);
    await page.goto('/admin/caisses');
    await page.getByLabel('Nom de la caisse').fill(tillName);
    await page.getByRole('button', { name: 'Ajouter la caisse' }).click();
    const url = (await page.getByTestId('scanner-url').textContent())!;
    expect(url).toMatch(/\/api\/pos\/v1\/douchette\/dpk_/);
    const address = url.replace(/^https?:\/\/[^/]+/, WEB_URL); // the page origin is the test server
    await page.getByRole('button', { name: 'Fermer', exact: true }).last().click();

    // JSON (format courant des douchettes Wi-Fi : identifiant de l'appareil + contenu lu)
    const first = await readyBeneficiary(api);
    const { token } = await api.qr(first.auth.accessToken);
    const json = await request.post(address, { data: { deviceId: 'DS-01', content: token } });
    expect(json.status()).toBe(200);
    expect(await json.json()).toMatchObject({ valid: true, discountPercent: 20, clientName: first.fullName });
    const me = await api.call<{ lastScan: { status: string; staffName: string } | null }>('GET', '/api/privileges/me', first.auth.accessToken);
    expect(me.lastScan).toMatchObject({ status: 'CONFIRMED', staffName: tillName });

    // le même code relu : refusé
    expect(await (await request.post(address, { data: { content: token } })).json()).toMatchObject({ valid: false, reason: 'QR_ALREADY_USED' });

    // formulaire, texte brut ou paramètre d'URL (GET)
    const second = await readyBeneficiary(api);
    const form = await request.post(address, { form: { code: (await api.qr(second.auth.accessToken)).token } });
    expect(await form.json()).toMatchObject({ valid: true });
    const third = await readyBeneficiary(api);
    const raw = await request.post(address, { data: `${(await api.qr(third.auth.accessToken)).token}\r\n`, headers: { 'Content-Type': 'text/plain' } });
    expect(await raw.json()).toMatchObject({ valid: true });
    const fourth = await readyBeneficiary(api);
    const get = await request.get(`${address}?data=${encodeURIComponent((await api.qr(fourth.auth.accessToken)).token)}`);
    expect(await get.json()).toMatchObject({ valid: true });

    // signal de vie ou code-barres d'un produit : ignoré ; la caisse apparaît comme reliée
    expect(await (await request.post(address, { data: { heartbeat: 1 } })).json()).toMatchObject({ valid: false, reason: 'NO_QR_CODE' });
    await page.reload();
    await expect(page.getByRole('row', { name: new RegExp(tillName) })).not.toContainText('—');

    // révoquée depuis l'administration : la douchette est coupée
    await page.getByRole('row', { name: new RegExp(tillName) }).getByRole('button', { name: 'Révoquer' }).click();
    await expect(page.getByRole('row', { name: new RegExp(tillName) })).toContainText('Révoquée');
    expect((await request.post(address, { data: { content: token } })).status()).toBeGreaterThanOrEqual(401);
  });
});
