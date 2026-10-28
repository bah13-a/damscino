import { devices, expect, test, type Page } from '@playwright/test';
import { Api, beneficiaryLogin, createTill, readyBeneficiary, specTicket, staffLogin, tillCall } from './support';

/** A handheld scanner ("douchette") types the code like a keyboard, with or without Enter at the end. */
async function handheldScan(page: Page, token: string, enter = false) {
  await expect(page.getByTestId('handheld-input')).toBeFocused();
  await page.keyboard.type(token, { delay: 2 });
  if (enter) await page.keyboard.press('Enter');
}

test.describe('Scan à la douchette · résultat affiché sur le téléphone du client', () => {
  test('douchette du caissier, puis résultat en direct sur l’écran QR du client', async ({ page, browser, request }) => {
    const api = new Api(request);
    const b = await readyBeneficiary(api);
    const staff = await api.createStaff(b.admin);
    await api.qr(b.auth.accessToken); // compte connu du service privilèges

    // téléphone du client : QR code du jour affiché
    const client = await (await browser.newContext({ ...devices['Pixel 7'], baseURL: test.info().project.use.baseURL })).newPage();
    const daily = client.waitForResponse((r) => r.url().endsWith('/api/privileges/qr/daily') && r.ok());
    await beneficiaryLogin(client, b.credentials.phone, b.password);
    await client.getByRole('button', { name: 'Utiliser mon avantage' }).click();
    const token: string = (await (await daily).json()).qrCode;
    await expect(client.getByTestId('qr-code').locator('svg')).toBeVisible({ timeout: 20_000 });
    await expect(client.getByTestId('scan-notice')).toHaveCount(0);

    // caissier : mode douchette, mémorisé pour les prochaines connexions
    await staffLogin(page, staff.username, staff.pin);
    await page.getByRole('tab', { name: 'Douchette' }).click();
    await expect(page.getByText('Prêt : scannez le QR code avec la douchette')).toBeVisible();
    await handheldScan(page, token);
    await expect(page.getByText('Avantage valide')).toBeVisible();

    const notice = client.getByTestId('scan-notice');
    await expect(notice).toContainText('Code scanné en caisse');
    await expect(notice).toContainText(`par ${staff.displayName}`);

    await page.getByLabel(/Prix du plat remisé/).fill('40');
    await page.getByRole('button', { name: 'Confirmer le passage' }).click();
    await expect(page.getByText('Passage validé')).toBeVisible();

    await expect(client.getByText('Avantage utilisé')).toBeVisible();
    await expect(client.getByTestId('validated-detail')).toContainText('Remise de −20 % (−8 DT sur 40 DT)');
    await expect(client.getByTestId('validated-detail')).toContainText(`par ${staff.displayName}`);

    // la douchette reste prête : le même code rescanné (avec Entrée) est refusé, et le client le voit
    await handheldScan(page, token, true);
    await expect(page.getByText('QR code déjà utilisé')).toBeVisible();
    await client.getByRole('button', { name: 'Terminer' }).click();
    await expect(client.getByText('Dernier scan en caisse')).toBeVisible();
    await expect(client.getByTestId('scan-notice').filter({ visible: true })).toContainText('Ce code a déjà été utilisé');

    await page.reload();
    await expect(page.getByRole('tab', { name: 'Douchette', selected: true })).toBeVisible();
  });

  test('scan par la caisse connectée : le client voit aussi la remise', async ({ request }) => {
    const api = new Api(request);
    const b = await readyBeneficiary(api);
    const till = await createTill(api, b.admin);
    const { token } = await api.qr(b.auth.accessToken);
    type Me = { lastScan: { status: string; staffName: string | null; discountAmount: number | null } | null };

    expect((await api.call<Me>('GET', '/api/privileges/me', b.auth.accessToken)).lastScan).toBeNull();
    const preview = await tillCall(request, till.apiKey, 'preview', specTicket(token, 'T-NOTICE'));
    expect(preview.body.status).toBe('VALID');
    const scanned = await api.call<Me>('GET', '/api/privileges/me', b.auth.accessToken);
    expect(scanned.lastScan).toMatchObject({ status: 'VALID', staffName: `${till.name} · Sami` });

    await tillCall(request, till.apiKey, 'confirm', { reservationId: preview.body.reservationId, ticketId: 'T-NOTICE' });
    const done = await api.call<Me>('GET', '/api/privileges/me', b.auth.accessToken);
    expect(done.lastScan).toMatchObject({ status: 'CONFIRMED', discountAmount: 8 });
  });
});
