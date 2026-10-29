import { expect, test } from '@playwright/test';
import { adminLogin, Api, readyBeneficiary, uid } from './support';

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
});
