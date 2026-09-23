import { expect, test } from '@playwright/test';
import { adminLogin, Api, eventually, uid } from './support';

test.describe('Administration · comptes administrateurs et personnel', () => {
  test('créer un compte scanner, changer son PIN et le désactiver', async ({ page, request }) => {
    const api = new Api(request);
    const username = `serveur${uid()}`;
    await adminLogin(page);
    await page.getByRole('link', { name: 'Comptes' }).first().click();

    await page.getByRole('button', { name: 'Nouveau compte' }).click();
    const dialog = page.getByRole('dialog', { name: 'Nouveau compte' });
    await dialog.getByLabel('Identifiant').fill(username);
    await dialog.getByLabel('Nom affiché').fill('Sami (serveur)');
    await dialog.getByLabel('Code PIN').fill('12a4');
    await dialog.getByRole('button', { name: 'Créer le compte' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Le code PIN doit contenir 4 à 8 chiffres');
    await dialog.getByLabel('Code PIN').fill('1357');
    await dialog.getByRole('button', { name: 'Créer le compte' }).click();

    const row = page.getByRole('row', { name: new RegExp(username) });
    await expect(row).toContainText('Sami (serveur)');
    await expect(row).toContainText('Scanner');
    await expect(row).toContainText('Actif');
    expect((await api.login('staff', username, '1357')).displayName).toBe('Sami (serveur)');

    // identifiant déjà pris
    await page.getByRole('button', { name: 'Nouveau compte' }).click();
    await dialog.getByLabel('Identifiant').fill(username);
    await dialog.getByLabel('Code PIN').fill('1111');
    await dialog.getByRole('button', { name: 'Créer le compte' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Cet identifiant est déjà utilisé');
    await dialog.getByRole('button', { name: 'Fermer' }).click();

    // nouveau PIN
    await row.getByRole('button', { name: 'Nouveau PIN' }).click();
    const reset = page.getByRole('dialog');
    await reset.getByLabel('Nouveau code PIN').fill('8642');
    await reset.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(reset).toBeHidden();
    expect((await api.raw('POST', '/api/auth/login', undefined, { username, password: '1357', space: 'STAFF' })).status()).toBe(401);
    await api.login('staff', username, '8642');

    // désactivation
    await row.getByRole('button', { name: 'Désactiver' }).click();
    await expect(row).toContainText('Désactivé');
    await eventually(async () => {
      expect((await api.raw('POST', '/api/auth/login', undefined, { username, password: '8642', space: 'STAFF' })).status()).toBe(403);
    });
    await row.getByRole('button', { name: 'Réactiver' }).click();
    await expect(row).toContainText('Actif');
  });

  test('un administrateur doit avoir un mot de passe de 8 caractères', async ({ page }) => {
    await adminLogin(page);
    await page.goto('/admin/comptes');
    await page.getByRole('button', { name: 'Nouveau compte' }).click();
    const dialog = page.getByRole('dialog', { name: 'Nouveau compte' });
    await dialog.getByLabel('Rôle').selectOption('ADMIN');
    await dialog.getByLabel('Identifiant').fill(`gerant${uid()}`);
    await dialog.getByLabel('Mot de passe provisoire').fill('court');
    await dialog.getByRole('button', { name: 'Créer le compte' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Le mot de passe doit contenir au moins 8 caractères');
  });

  test("l'administrateur connecté ne peut pas se désactiver lui-même", async ({ page }) => {
    await adminLogin(page);
    await page.goto('/admin/comptes');
    const me = page.getByRole('row', { name: /Super administrateur/ });
    await expect(me).toBeVisible();
    await expect(me.getByRole('button', { name: 'Désactiver' })).toHaveCount(0);
  });
});
