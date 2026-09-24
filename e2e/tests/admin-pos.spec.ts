import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { adminLogin, Api, createTill, eventually, readyBeneficiary, readText, specTicket, tillCall, uid } from './support';

test.describe('Intégration caisse · administration et simulateur', () => {
  test('créer une caisse, afficher sa clé une seule fois, la régénérer puis la révoquer', async ({ page, request }) => {
    await adminLogin(page);
    await page.getByRole('link', { name: 'Caisses' }).first().click();
    await expect(page.getByRole('heading', { name: 'Intégration caisse' })).toBeVisible();

    const name = `Caisse Salle ${uid()}`;
    await page.getByLabel('Nom de la caisse').fill(name);
    await page.getByRole('button', { name: 'Ajouter la caisse' }).click();
    const firstKey = (await page.getByTestId('api-key').textContent())!.trim();
    expect(firstKey).toMatch(/^dpk_[\w-]{32}$/);
    await page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).first().click();

    const row = page.getByRole('row', { name: new RegExp(name) });
    await expect(row).toContainText(`${firstKey.slice(0, 12)}…`);
    await expect(row).toContainText('Active');
    expect((await tillCall(request, firstKey, 'ping')).body.terminal).toBe(name);

    page.once('dialog', (dialog) => dialog.accept());
    await row.getByRole('button', { name: 'Nouvelle clé' }).click();
    const secondKey = (await page.getByTestId('api-key').textContent())!.trim();
    expect(secondKey).not.toBe(firstKey);
    await page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).first().click();
    expect((await tillCall(request, firstKey, 'ping')).status).toBe(401);
    expect((await tillCall(request, secondKey, 'ping')).status).toBe(200);

    await row.getByRole('button', { name: 'Révoquer' }).click();
    await expect(row).toContainText('Révoquée');
    expect((await tillCall(request, secondKey, 'ping')).status).toBe(401);
    await expect(row).toContainText(/\d{2}\/\d{2}\/\d{4}/); // dernier appel enregistré
  });

  test('correspondance des articles : saisie et import CSV', async ({ page }) => {
    const sku = `KEB-${uid().toUpperCase()}`;
    await adminLogin(page);
    await page.goto('/admin/caisses');
    await page.getByLabel('Référence (SKU)').fill(sku);
    await page.getByLabel('Libellé').fill('Azmari Kebab');
    await page.getByLabel('Catégorie').selectOption({ label: 'Plats' });
    await page.locator('form', { has: page.getByLabel('Référence (SKU)') }).getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByRole('row', { name: new RegExp(sku) })).toContainText('Plats');

    const csv = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dp-pos-')), 'articles.csv');
    fs.writeFileSync(csv, `référence;libellé;catégorie\nEAU-${sku};Eau 0,5 L;Boissons\nKUN-${sku};Kunafa;DESSERTS\nXX;Inconnu;Pizzas\n`);
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Importer CSV' }).click()]);
    await chooser.setFiles(csv);
    await expect(page.getByText('2 article(s) enregistré(s).')).toBeVisible();
    await expect(page.getByText(/Ligne 4 : référence ou catégorie inconnue/)).toBeVisible();
    await expect(page.getByRole('row', { name: new RegExp(`EAU-${sku}`) })).toContainText('Boissons');

    await page.getByRole('row', { name: new RegExp(`KUN-${sku}`) }).getByRole('button', { name: 'Supprimer' }).click();
    await expect(page.getByRole('row', { name: new RegExp(`KUN-${sku}`) })).toHaveCount(0);
  });

  test('simulateur : aperçu 59 → 51 DT, encaissement, puis annulation du ticket', async ({ page, request }) => {
    const api = new Api(request);
    const b = await readyBeneficiary(api);
    const till = await createTill(api, b.admin);
    const { token } = await api.qr(b.auth.accessToken);

    await adminLogin(page);
    await page.goto('/admin/caisses/simulateur');
    await page.getByLabel("Clé d'API de la caisse").fill(till.apiKey);
    await page.getByRole('button', { name: 'Tester la connexion' }).click();
    await expect(page.getByText(`Connecté en tant que « ${till.name} ».`)).toBeVisible();

    const ticket = await page.getByLabel('N° de ticket').inputValue();
    await page.getByLabel('QR code du client').fill(token);
    await page.getByRole('button', { name: '1. Aperçu de la remise' }).click();
    await expect(page.getByText('Avantage valide', { exact: true })).toBeVisible();
    await expect(page.getByText(`${b.fullName} · ${b.partner.name}`)).toBeVisible();
    await expect(page.getByText('Damascino Privilèges −20 % · Azmari Kebab')).toBeVisible();
    await expect(page.getByText('−8 DT')).toBeVisible();
    await expect(page.getByRole('definition').filter({ hasText: '59 DT' })).toBeVisible();
    await expect(page.getByRole('definition').filter({ hasText: '51 DT' })).toBeVisible();
    await expect(page.getByText('POST /api/pos/v1/preview → 200')).toBeVisible();

    await page.getByRole('button', { name: '2. Encaisser le ticket' }).click();
    await expect(page.getByText(/Ticket payé : passage enregistré \(code \d{6}\)/)).toBeVisible();

    // le passage apparaît dans le journal, avec la caisse, le ticket et le plat
    await eventually(async () => {
      const usages = await api.call<{ items: any[] }>('GET', `/api/reporting/usages?partnerId=${b.partner.id}`, b.admin);
      expect(usages.items[0]).toMatchObject({ channel: 'POS', ticketId: ticket, dishLabel: 'Azmari Kebab', discountAmount: 8 });
    });
    const again = await api.raw('POST', '/api/privileges/qr', b.auth.accessToken);
    expect((await again.json()).code).toBe('QUOTA_REACHED');

    await page.getByRole('button', { name: 'Annuler le ticket' }).click();
    await expect(page.getByText("Ticket annulé : l'avantage est de nouveau disponible.")).toBeVisible();
    await api.qr(b.auth.accessToken); // de nouveau disponible

    await page.goto('/admin/utilisations');
    await page.getByLabel('Partenaire').selectOption({ label: b.partner.name });
    const row = page.getByRole('row', { name: new RegExp(ticket) });
    await eventually(async () => {
      await page.reload();
      await page.getByLabel('Partenaire').selectOption({ label: b.partner.name });
      await expect(row).toContainText('Annulé', { timeout: 2_000 });
    });
    await expect(row).toContainText('Caisse');
    await expect(row).toContainText('Azmari Kebab');
    await expect(row).toContainText(`${till.name} · Sami`);

    // les passages annulés ne comptent pas dans les statistiques
    const stats = await api.call<{ totals: { redemptions: number; discountTotal: number } }>('GET', `/api/reporting/statistics?partnerId=${b.partner.id}`, b.admin);
    expect(stats.totals).toMatchObject({ redemptions: 0, discountTotal: 0 });
    const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV' }).click()]);
    expect(readText(await csv.path())).toContain(`;Caisse;${ticket};Azmari Kebab;`);
  });
});

test.describe('Intégration caisse · contrat de l’API', () => {
  test('confirmation idempotente et ticket modifié entre deux aperçus', async ({ request }) => {
    const api = new Api(request);
    const b = await readyBeneficiary(api);
    const till = await createTill(api, b.admin);
    const { token } = await api.qr(b.auth.accessToken);

    const first = await tillCall(request, till.apiKey, 'preview', specTicket(token, 'T-IDEM'));
    expect(first.body).toMatchObject({ status: 'VALID', totalBefore: 59, totalAfter: 51, discount: { lineId: '2', amount: 8 } });

    // le client ajoute un mixed grill à 52 DT : le même QR met à jour la réservation, sans en créer une deuxième
    const bigger = specTicket(token, 'T-IDEM');
    bigger.lines.push({ lineId: '4', sku: 'MIX', label: 'Mixed grill', category: 'PLATS', unitPrice: 52, quantity: 1 });
    const second = await tillCall(request, till.apiKey, 'preview', bigger);
    expect(second.body).toMatchObject({ status: 'VALID', reservationId: first.body.reservationId, discount: { lineId: '4', amount: 10.4 } });

    const confirm = { reservationId: first.body.reservationId, ticketId: 'T-IDEM' };
    const a = await tillCall(request, till.apiKey, 'confirm', confirm);
    const replay = await tillCall(request, till.apiKey, 'confirm', confirm);
    expect(a.body.status).toBe('CONFIRMED');
    expect(replay.body).toMatchObject({ status: 'CONFIRMED', redemptionId: a.body.redemptionId, validationCode: a.body.validationCode });

    const cancel = await tillCall(request, till.apiKey, 'cancel', { ticketId: 'T-IDEM', reason: 'Remboursement' });
    expect(cancel.body.status).toBe('CANCELLED');
    expect((await tillCall(request, till.apiKey, 'cancel', { ticketId: 'T-IDEM' })).body.status).toBe('NOTHING_TO_CANCEL');
  });

  test("la réservation d'un ticket ouvert bloque un second usage, y compris sur la tablette", async ({ request }) => {
    const api = new Api(request);
    const b = await readyBeneficiary(api);
    const till = await createTill(api, b.admin);
    const staff = await api.createStaff(b.admin);
    const staffToken = (await api.login('staff', staff.username, staff.pin)).accessToken;
    const first = (await api.qr(b.auth.accessToken)).token;
    const second = (await api.qr(b.auth.accessToken)).token;

    expect((await tillCall(request, till.apiKey, 'preview', specTicket(first, 'T-A'))).body.status).toBe('VALID');
    expect((await api.verify(staffToken, second)).reason).toBe('QUOTA_REACHED');
    const other = await tillCall(request, till.apiKey, 'preview', specTicket(second, 'T-B'));
    expect(other.body).toMatchObject({ status: 'REFUSED', reason: 'QUOTA_REACHED' });
    // le même QR ne peut pas servir sur un autre ticket
    expect((await tillCall(request, till.apiKey, 'preview', specTicket(first, 'T-C'))).body.reason).toBe('QR_ALREADY_USED');

    // ticket abandonné : l'annulation libère l'avantage
    await tillCall(request, till.apiKey, 'cancel', { ticketId: 'T-A' });
    const third = (await api.qr(b.auth.accessToken)).token;
    expect((await api.verify(staffToken, third)).status).toBe('VALID');
  });

  test('refus : pas de plat éligible, ticket déjà remisé, réservation inconnue, clé absente', async ({ request }) => {
    const api = new Api(request);
    const b = await readyBeneficiary(api);
    const other = await readyBeneficiary(api);
    const till = await createTill(api, b.admin);
    const { token } = await api.qr(b.auth.accessToken);

    // boissons et desserts seuls : refus, et le QR reste utilisable
    const drinks = { ...specTicket(token, 'T-DRINKS'), lines: specTicket(token, 'x').lines.filter((l) => l.category !== 'PLATS') };
    expect((await tillCall(request, till.apiKey, 'preview', drinks)).body).toMatchObject({ status: 'REFUSED', reason: 'NO_ELIGIBLE_ITEM', totalBefore: 19, totalAfter: 19 });
    expect((await tillCall(request, till.apiKey, 'preview', specTicket(token, 'T-OK'))).body.status).toBe('VALID');

    // un seul avantage Damascino par ticket
    const otherToken = (await api.qr(other.auth.accessToken)).token;
    expect((await tillCall(request, till.apiKey, 'preview', specTicket(otherToken, 'T-OK'))).body.reason).toBe('TICKET_ALREADY_DISCOUNTED');

    expect((await tillCall(request, till.apiKey, 'confirm', { reservationId: '00000000-0000-0000-0000-000000000000', ticketId: 'T-OK' })).body.reason).toBe('RESERVATION_NOT_FOUND');
    expect((await tillCall(request, till.apiKey, 'preview', { ...specTicket(token, 'T-EMPTY'), lines: [] })).status).toBe(400);
    expect((await tillCall(request, till.apiKey, 'preview', specTicket('DP1.faux.code', 'T-X'))).body.reason).toBe('INVALID_QR');
    expect((await request.post('/api/pos/v1/preview', { data: specTicket(token, 'T-Y') })).status()).toBe(401);
  });

  test("sans catégorie envoyée par la caisse, la table des articles s'applique", async ({ request }) => {
    const api = new Api(request);
    const b = await readyBeneficiary(api);
    const till = await createTill(api, b.admin);
    const sku = `PLAT-${uid().toUpperCase()}`;
    await api.call('PUT', '/api/pos-products', b.admin, [{ sku, label: 'Chich taouk', category: 'PLATS' }]);
    const { token } = await api.qr(b.auth.accessToken);

    const ticket = {
      code: token,
      ticketId: 'T-SKU',
      lines: [
        { lineId: '1', sku: 'INCONNU', label: 'Article inconnu', unitPrice: 60, quantity: 1 },
        { lineId: '2', sku, label: 'Chich taouk', unitPrice: 25, quantity: 2 },
      ],
    };
    const preview = await tillCall(request, till.apiKey, 'preview', ticket);
    expect(preview.body).toMatchObject({ status: 'VALID', discount: { lineId: '2', category: 'PLATS', amount: 5 }, totalBefore: 110, totalAfter: 105 });
  });
});
