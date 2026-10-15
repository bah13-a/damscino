import { expect, test } from '@playwright/test';
import { adminLogin, Api, eventually, randomPhone, readText, uid } from './support';

test.describe('Administration · bénéficiaires', () => {
  test('ajout manuel, recherche, modification, désactivation, réinitialisation et historique', async ({ page, request }) => {
    const api = new Api(request);
    const token = await api.admin();
    const partner = await api.createPartner(token);
    const lastName = `Mansour${uid()}`;
    const phone = randomPhone();
    const email = `${lastName.toLowerCase()}@exemple.tn`;

    await adminLogin(page);
    await page.getByRole('link', { name: 'Bénéficiaires' }).first().click();

    // ajout manuel → accès généré
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Ajouter un bénéficiaire' });
    await form.getByLabel('Partenaire').selectOption({ label: partner.name });
    await form.getByLabel('Nom', { exact: true }).fill(lastName);
    await form.getByLabel('Prénom').fill('Yasmine');
    await form.getByLabel('Téléphone (identifiant)').fill(`+216 ${phone}`);
    await form.getByLabel('E-mail (facultatif)').fill(email.toUpperCase());
    await form.getByRole('button', { name: 'Ajouter et générer les accès' }).click();
    const access = page.getByRole('dialog', { name: 'Accès généré' });
    await expect(access.getByText(phone.replace(/(\d{2})(\d{3})(\d{3})/, '$1 $2 $3'))).toBeVisible();
    const temporary = (await access.locator('dd').nth(1).textContent())!.trim();
    expect(temporary).toMatch(/^[A-Za-z2-9]{10}$/);
    await access.getByRole('button', { name: 'Fermer' }).first().click();

    // numéro déjà utilisé
    await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
    await form.getByLabel('Partenaire').selectOption({ label: partner.name });
    await form.getByLabel('Nom', { exact: true }).fill('Autre');
    await form.getByLabel('Prénom').fill('Personne');
    await form.getByLabel('Téléphone (identifiant)').fill(phone);
    await form.getByRole('button', { name: 'Ajouter et générer les accès' }).click();
    await expect(form.getByRole('alert')).toHaveText('Ce numéro de téléphone est déjà enregistré');
    await form.getByRole('button', { name: 'Fermer' }).click();

    // recherche par nom puis par téléphone
    const search = page.getByPlaceholder('Nom, prénom ou téléphone');
    await search.fill(lastName.toLowerCase());
    const row = page.getByRole('row', { name: new RegExp(lastName) });
    await expect(row).toBeVisible();
    await expect(row).toContainText('À activer');
    await expect(row).toContainText(email);
    await expect(page.getByText('1 bénéficiaire(s)')).toBeVisible();
    await search.fill(phone.slice(2, 6));
    await expect(row).toBeVisible();

    // modification
    await search.fill(lastName);
    await row.getByRole('button', { name: 'Modifier' }).click();
    const edit = page.getByRole('dialog', { name: 'Modifier le bénéficiaire' });
    await edit.getByLabel('Prénom').fill('Yasmina');
    await edit.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(row).toContainText(`${lastName} Yasmina`);

    // désactivation : le compte ne peut plus se connecter ; réactivation
    await row.getByRole('button', { name: 'Désactiver' }).click();
    await expect(row).toContainText('Désactivé');
    await eventually(async () => {
      const response = await api.raw('POST', '/api/auth/login', undefined, { username: phone, password: temporary, space: 'BENEFICIARY' });
      expect(response.status()).toBe(403);
    });
    await page.getByLabel('Statut').selectOption('false');
    await expect(row).toBeVisible();
    await page.getByLabel('Statut').selectOption('true');
    await expect(row).toHaveCount(0);
    await page.getByLabel('Statut').selectOption('');
    await row.getByRole('button', { name: 'Réactiver' }).click();
    await expect(row).toContainText('À activer');

    // réinitialisation du mot de passe : l'ancien ne fonctionne plus, le nouveau oui
    page.once('dialog', (dialog) => dialog.accept());
    await row.getByRole('button', { name: 'Réinitialiser' }).click();
    const reset = page.getByRole('dialog', { name: 'Accès généré' });
    const newTemporary = (await reset.locator('dd').nth(1).textContent())!.trim();
    expect(newTemporary).not.toBe(temporary);
    await reset.getByRole('button', { name: 'Fermer' }).first().click();
    await eventually(async () => {
      expect((await api.raw('POST', '/api/auth/login', undefined, { username: phone, password: temporary, space: 'BENEFICIARY' })).status()).toBe(401);
      const auth = await api.login('beneficiary', phone, newTemporary);
      expect(auth.mustChangePassword).toBe(true);
    });

    // historique (aucun passage)
    await row.getByRole('button', { name: 'Historique' }).click();
    await expect(page.getByRole('dialog').getByText('Aucun passage.')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click();

    // export CSV filtré
    const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV' }).click()]);
    const content = readText(await csv.path());
    expect(content.split(/\r?\n/)[0]).toBe('Nom;Prénom;Téléphone;E-mail;Partenaire;Statut;Compte activé;Activé le;Ajouté le');
    expect(content).toContain(`${lastName};Yasmina;${phone};${email};${partner.name};Actif;Non`);
  });
});
