import { expect, test } from '@playwright/test';
import { Api, DEFAULT_TILL_SETTINGS, readyBeneficiary, setTillSettings, uiLogin } from './support';

async function manualScan(page: import('@playwright/test').Page, token: string) {
  await page.getByText('Saisie manuelle du code').click();
  await page.getByPlaceholder('DP1…').fill(token);
  await page.getByRole('button', { name: 'Vérifier' }).click();
}

test.describe('Remise saisie dans la caisse existante · tablette', () => {
  test.afterEach(async ({ request }) => {
    const api = new Api(request);
    await setTillSettings(api, await api.admin(), DEFAULT_TILL_SETTINGS);
  });

  test('après validation, la tablette indique quoi saisir dans la rubrique Remise (en % sur la ligne)', async ({ page, request }) => {
    const api = new Api(request);
    const b = await readyBeneficiary(api);
    const staff = await api.createStaff(b.admin);
    const { token } = await api.qr(b.auth.accessToken);

    await uiLogin(page, 'staff', staff.username, staff.pin);
    await manualScan(page, token);
    await page.getByLabel(/Prix du plat remisé/).fill('40');
    await page.getByRole('button', { name: 'Confirmer le passage' }).click();

    const instructions = page.getByTestId('till-instructions');
    await expect(instructions).toContainText('À saisir maintenant dans la caisse');
    await expect(instructions).toContainText('Rubrique Remise → « Damascino Privilèges »');
    await expect(instructions).toContainText('20 % sur la ligne du plat à 40 DT (soit −8 DT)');
    await expect(instructions).toContainText(/Commentaire du ticket : \d{6}/);
  });

  test('en montant sur le ticket avec prix obligatoire', async ({ page, request }) => {
    const api = new Api(request);
    const b = await readyBeneficiary(api);
    await setTillSettings(api, b.admin, { discountLabel: 'Remise Privilèges', applyMode: 'TICKET_AMOUNT', priceRequired: true });
    const staff = await api.createStaff(b.admin);
    const staffToken = (await api.login('staff', staff.username, staff.pin)).accessToken;

    // le serveur refuse aussi une confirmation sans prix
    const { token: first } = await api.qr(b.auth.accessToken);
    const withoutPrice = await api.raw('POST', '/api/privileges/scan/confirm', staffToken, { token: first });
    expect(withoutPrice.status()).toBe(400);
    expect((await withoutPrice.json()).code).toBe('PRICE_REQUIRED');

    const { token } = await api.qr(b.auth.accessToken);
    await uiLogin(page, 'staff', staff.username, staff.pin);
    await manualScan(page, token);
    await expect(page.getByText('Obligatoire : sert au rapprochement avec la caisse')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirmer le passage' })).toBeDisabled();
    await page.getByLabel('Prix du plat remisé (DT)').fill('35');
    await page.getByRole('button', { name: 'Confirmer le passage' }).click();

    const instructions = page.getByTestId('till-instructions');
    await expect(instructions).toContainText('Rubrique Remise → « Remise Privilèges »');
    await expect(instructions).toContainText('Remise en montant sur le ticket : −7 DT');
  });
});
