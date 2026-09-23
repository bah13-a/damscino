import { expect, test } from '@playwright/test';
import { adminLogin, Api, readXlsx, uid } from './support';

test.describe('Administration · partenaires et règles', () => {
  test.beforeEach(async ({ page }) => adminLogin(page));

  test('créer un partenaire avec la règle V1 par défaut', async ({ page }) => {
    const name = `Mall of Sfax ${uid()}`;
    await page.getByRole('link', { name: 'Partenaires' }).first().click();
    await page.getByRole('button', { name: 'Nouveau partenaire' }).click();
    const dialog = page.getByRole('dialog', { name: 'Nouveau partenaire' });
    await dialog.getByLabel('Nom du partenaire').fill(name);
    await dialog.getByLabel('Début de convention').fill('2026-01-01');
    await dialog.getByLabel('Fin de convention').fill('2026-12-31');
    await dialog.getByLabel('Contact', { exact: true }).fill('M. Ali');
    await dialog.getByLabel('E-mail du contact').fill('contact@mall.tn');
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();

    await expect(page.getByRole('heading', { name })).toBeVisible();
    await expect(page.getByText('Du 1 janvier 2026')).toBeVisible();
    await expect(page.getByText('−20 %')).toBeVisible();
    await expect(page.getByText('1 utilisation(s) par jour')).toBeVisible();
    await expect(page.getByText('Éligibles : Plats')).toBeVisible();
    await expect(page.getByText('Exclues : Boissons, Desserts')).toBeVisible();

    await page.getByRole('link', { name: '← Partenaires' }).click();
    await expect(page.getByRole('row', { name: new RegExp(name) })).toContainText('−20 % · 1/jour');
  });

  test('refuser une convention qui se termine avant de commencer', async ({ page }) => {
    await page.goto('/admin/partenaires');
    await page.getByRole('button', { name: 'Nouveau partenaire' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nom du partenaire').fill(`Invalide ${uid()}`);
    await dialog.getByLabel('Début de convention').fill('2026-12-31');
    await dialog.getByLabel('Fin de convention').fill('2026-01-01');
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('La date de fin doit être postérieure à la date de début');
  });

  test('refuser un nom de partenaire déjà utilisé', async ({ page, request }) => {
    const api = new Api(request);
    const existing = await api.createPartner(await api.admin());
    await page.goto('/admin/partenaires');
    await page.getByRole('button', { name: 'Nouveau partenaire' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nom du partenaire').fill(existing.name);
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Un partenaire porte déjà ce nom');
  });

  test("modifier la règle d'avantage, le profil et le statut", async ({ page, request }) => {
    const api = new Api(request);
    const partner = await api.createPartner(await api.admin());
    await page.goto(`/admin/partenaires/${partner.id}`);

    await page.getByRole('button', { name: 'Modifier' }).nth(1).click();
    const rule = page.getByRole('dialog', { name: "Règle d'avantage" });
    await rule.getByLabel('Remise (%)').fill('25');
    await rule.getByLabel('Utilisations').fill('2');
    await rule.getByLabel('Par').selectOption('WEEK');
    await rule.locator('div', { hasText: /^Desserts/ }).getByRole('button', { name: 'Éligible' }).click();
    await rule.getByRole('button', { name: 'Enregistrer la règle' }).click();
    await expect(rule).toBeHidden();
    await expect(page.getByText('−25 %')).toBeVisible();
    await expect(page.getByText('2 utilisation(s) par semaine')).toBeVisible();
    await expect(page.getByText('Éligibles : Desserts, Plats')).toBeVisible();
    await expect(page.getByText('Exclues : Boissons')).toBeVisible();

    // une règle sans catégorie éligible est refusée
    await page.getByRole('button', { name: 'Modifier' }).nth(1).click();
    for (const label of ['Desserts', 'Plats']) {
      await rule.locator('div', { hasText: new RegExp(`^${label}`) }).getByRole('button', { name: '—' }).click();
    }
    await rule.getByRole('button', { name: 'Enregistrer la règle' }).click();
    await expect(rule.getByRole('alert')).toHaveText('Au moins une catégorie éligible est requise');
    await rule.getByRole('button', { name: 'Fermer' }).click();

    await page.getByRole('button', { name: 'Modifier' }).first().click();
    const profile = page.getByRole('dialog', { name: 'Modifier le partenaire' });
    await profile.getByLabel('Téléphone du contact').fill('74 000 000');
    await profile.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText('74 000 000')).toBeVisible();

    await page.getByRole('button', { name: 'Désactiver' }).first().click();
    await expect(page.getByText('Partenaire inactif')).toBeVisible();
    await page.getByRole('button', { name: 'Activer', exact: true }).click();
    await expect(page.getByText('En cours')).toBeVisible();
  });

  test("le lien d'activation ouvre une page de connexion au nom du partenaire", async ({ page, context, request }) => {
    const api = new Api(request);
    const partner = await api.createPartner(await api.admin());
    await page.goto(`/admin/partenaires/${partner.id}`);
    const link = await page.locator('p.font-mono').textContent();
    expect(link).toContain(`/connexion?p=${partner.id}`);

    const visitor = await context.browser()!.newPage();
    await visitor.goto(link!.trim());
    await expect(visitor.getByText(`Bienvenue aux collaborateurs de ${partner.name}`)).toBeVisible();
    await visitor.close();
  });

  test('exporter la liste des partenaires en Excel et CSV', async ({ page, request }) => {
    const api = new Api(request);
    const partner = await api.createPartner(await api.admin());
    await page.goto('/admin/partenaires');

    const [xlsx] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exporter Excel' }).click()]);
    expect(xlsx.suggestedFilename()).toBe('partenaires.xlsx');
    const rows = await readXlsx(await xlsx.path());
    expect(rows[0]).toEqual(expect.arrayContaining(['Partenaire', 'Début convention', 'Remise %', 'Bénéficiaires']));
    expect(rows.some((r) => r[0] === partner.name)).toBe(true);

    const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV' }).click()]);
    expect(csv.suggestedFilename()).toBe('partenaires.csv');
  });
});
