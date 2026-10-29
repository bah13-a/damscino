import { devices, expect, test, type Browser, type Page } from '@playwright/test';
import { Api, beneficiaryLogin, createTill, manualScan, readyBeneficiary, specTicket, staffLogin, tillCall } from './support';

type Ready = Awaited<ReturnType<typeof readyBeneficiary>>;

/** Customer's phone showing the QR code of the day; returns the page and the code it displays. */
async function showQrCode(browser: Browser, b: Ready): Promise<{ client: Page; token: string }> {
  const context = await browser.newContext({ ...devices['Pixel 7'], baseURL: test.info().project.use.baseURL });
  const client = await context.newPage();
  const daily = client.waitForResponse((r) => r.url().endsWith('/api/privileges/qr/daily') && r.ok());
  await beneficiaryLogin(client, b.credentials.phone, b.password);
  await client.getByRole('button', { name: 'Utiliser mon avantage' }).click();
  const token: string = (await (await daily).json()).qrCode;
  await expect(client.getByTestId('qr-code').locator('svg')).toBeVisible({ timeout: 20_000 });
  await expect(client.getByTestId('scan-notice')).toHaveCount(0);
  return { client, token };
}

test.describe('Résultat du scan affiché en direct sur le téléphone du client', () => {
  test('scan par le téléphone du caissier', async ({ page, browser, request }) => {
    const api = new Api(request);
    const b = await readyBeneficiary(api);
    const staff = await api.createStaff(b.admin);
    await api.qr(b.auth.accessToken); // compte connu du service privilèges
    const { client, token } = await showQrCode(browser, b);

    await staffLogin(page, staff.username, staff.pin);
    await manualScan(page, token);
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
  });

  test('scan par la douchette branchée sur la caisse (validate-qr)', async ({ browser, request }) => {
    const api = new Api(request);
    const b = await readyBeneficiary(api);
    const till = await createTill(api, b.admin);
    await api.qr(b.auth.accessToken);
    const { client, token } = await showQrCode(browser, b);

    // la caisse envoie le texte lu par la douchette et applique sa remise standard si valid = true
    const scan = await tillCall(request, till.apiKey, 'validate-qr', { qrCode: token, cashier: 'Sami', ticketId: 'T-DOUCHETTE' });
    expect(scan.status).toBe(200);
    expect(scan.body).toMatchObject({
      valid: true,
      discountName: 'Damascino Privilèges',
      discountPercent: 20,
      clientName: b.fullName,
      partnerName: b.partner.name,
    });
    expect(scan.body.validationCode).toMatch(/^\d{6}$/);

    await expect(client.getByText('Avantage utilisé')).toBeVisible();
    await expect(client.getByTestId('validated-detail')).toContainText('Remise de −20 %');
    await expect(client.getByTestId('validated-detail')).toContainText(`par ${till.name} · Sami`);

    // le passage compte (quota, historique) et le même code rescanné est refusé, ce que le client voit aussi
    const again = await tillCall(request, till.apiKey, 'validate-qr', { qrCode: token });
    expect(again.body).toMatchObject({ valid: false, reason: 'QR_ALREADY_USED', message: 'QR code déjà utilisé' });
    await client.getByRole('button', { name: 'Terminer' }).click();
    await expect(client.getByText('Dernier scan en caisse')).toBeVisible();
    await expect(client.getByTestId('scan-notice').filter({ visible: true })).toContainText('Ce code a déjà été utilisé');
    await expect(client.getByText('Déjà utilisé aujourd’hui').or(client.getByText("Déjà utilisé aujourd'hui"))).toBeVisible();
    await expect(client.getByText(/De nouveau disponible le/)).toBeVisible();

    // un texte qui n'est pas un QR Damascino (mauvaise lecture) ne valide rien
    expect((await tillCall(request, till.apiKey, 'validate-qr', { qrCode: 'DP1.abc.def' })).body).toMatchObject({ valid: false, reason: 'INVALID_QR' });
  });

  test('caisse connectée (preview / confirm) : le client voit aussi la remise', async ({ request }) => {
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
