import { expect, test } from '@playwright/test';
import { adminLogin, Api, eventually, readText, readXlsx, readyBeneficiary } from './support';

test.describe('Administration · statistiques, utilisations, journal et exports', () => {
  test('les passages et refus de la caisse alimentent les tableaux et les exports', async ({ page, request }) => {
    const api = new Api(request);
    const b = await readyBeneficiary(api);
    const second = await api.createBeneficiary(b.admin, b.partner.id, 'Nour', 'Gharbi');
    await api.activate(second);
    const staff = await api.createStaff(b.admin);
    const staffToken = (await api.login('staff', staff.username, staff.pin)).accessToken;

    const { token } = await api.qr(b.auth.accessToken);
    expect((await api.confirm(staffToken, token, 40)).discountAmount).toBe(8);
    expect((await api.confirm(staffToken, token)).reason).toBe('QR_ALREADY_USED');

    const stats = `/api/reporting/statistics?partnerId=${b.partner.id}`;
    await eventually(async () => {
      const s = await api.call<{ totals: Record<string, number> }>('GET', stats, b.admin);
      expect(s.totals).toMatchObject({ authorized: 2, activated: 2, activeUsers: 1, redemptions: 1, refusals: 1 });
    }, 30_000);

    await adminLogin(page);

    // tableau de bord filtré sur le partenaire
    await page.getByLabel('Partenaire').selectOption({ label: b.partner.name });
    const kpi = (label: string) => page.locator('div.rounded-2xl', { has: page.getByText(label, { exact: true }) }).first();
    await expect(kpi('Autorisés')).toContainText('2');
    await expect(kpi('Comptes activés')).toContainText('100 % des autorisés');
    await expect(kpi('Utilisateurs actifs')).toContainText('1');
    await expect(kpi('Passages')).toContainText('1 refus');
    await expect(kpi('Remises accordées')).toContainText('8 DT');
    await expect(kpi('Remises accordées')).toContainText('sur 40 DT de plats');
    await expect(page.getByRole('img', { name: 'Passages par jour' })).toBeVisible();
    await expect(page.getByRole('row', { name: new RegExp(b.partner.name) })).toContainText('8 DT');
    await page.getByRole('button', { name: "Aujourd'hui" }).click();
    await expect(kpi('Passages')).toContainText('1');

    const [statsXlsx] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exporter Excel' }).click()]);
    const statsRows = await readXlsx(await statsXlsx.path());
    expect(statsRows[0]).toEqual(['Partenaire', 'Statut', 'Autorisés', 'Comptes activés', 'Utilisateurs actifs', 'Passages', 'Remises (DT)']);
    expect(statsRows[1]).toEqual([b.partner.name, 'Actif', '2', '2', '1', '1', '8']);

    // journal des passages et des refus
    await page.getByRole('link', { name: 'Utilisations' }).first().click();
    await page.getByLabel('Partenaire').selectOption({ label: b.partner.name });
    const usage = page.getByRole('row', { name: new RegExp(b.fullName) });
    await expect(usage).toContainText(staff.displayName);
    await expect(usage).toContainText('40 DT');
    await expect(usage).toContainText('8 DT');
    const [usagesCsv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV' }).click()]);
    const csv = readText(await usagesCsv.path()).split(/\r?\n/);
    expect(csv[0]).toBe(
      'Date et heure;Bénéficiaire;Partenaire;Membre du personnel;Prix du plat (DT);Remise %;Montant remisé (DT);Canal;N° de ticket;Plat remisé;Code de validation;Annulation',
    );
    expect(csv[1]).toMatch(new RegExp(`;${b.fullName};${b.partner.name};${staff.displayName};40\\.000;20\\.00;8\\.000;Scanner;;;\\d{6};$`));

    await page.getByRole('button', { name: 'Refus' }).click();
    const refusal = page.getByRole('row', { name: new RegExp(b.fullName) });
    await expect(refusal).toContainText('QR déjà utilisé');
    await expect(refusal).toContainText('Confirmation');
    const [refusalsXlsx] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exporter Excel' }).click()]);
    expect(refusalsXlsx.suggestedFilename()).toBe('refus.xlsx');

    // historique du bénéficiaire
    await page.goto(`/admin/partenaires/${b.partner.id}`);
    await page.getByRole('row', { name: new RegExp(b.credentials.lastName) }).getByRole('button', { name: 'Historique' }).click();
    await expect(page.getByRole('dialog').getByText(`validé par ${staff.displayName}`)).toBeVisible();
    await expect(page.getByRole('dialog').getByText('8 DT')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click();
    await expect(page.getByRole('row', { name: new RegExp(b.credentials.lastName) })).toContainText('Activé');

    // journal d'administration
    await page.getByRole('link', { name: 'Journal' }).first().click();
    await page.getByPlaceholder('Rechercher (auteur, action, détail)').fill(b.partner.name);
    await expect(page.getByRole('row', { name: new RegExp(`Partenaire créé ${b.partner.name}`) })).toContainText('Super administrateur');
    await expect(page.getByRole('row', { name: /Bénéficiaire ajouté/ }).first()).toBeVisible();
    const [auditXlsx] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exporter Excel' }).click()]);
    const audit = await readXlsx(await auditXlsx.path());
    expect(audit[0]).toEqual(['Date et heure', 'Auteur', 'Action', 'Objet', 'Détails']);
    expect(audit.some((r) => r[2] === 'PARTNER_CREATED' && r[4] === b.partner.name)).toBe(true);
  });
});
