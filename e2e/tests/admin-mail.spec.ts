import { expect, test } from '@playwright/test';
import { adminLogin, Api } from './support';

/** Administration → Messagerie: the e-mail account that sends the activation codes. */
test.describe('Administration · messagerie', () => {
  // the test environment has no mail server: the other tests rely on the simulated e-mail (code shown in the app)
  test.afterEach(async ({ request }) => {
    const api = new Api(request);
    await api.call('DELETE', '/api/mail-settings', await api.admin());
  });

  test('saisie du compte Gmail, test d’envoi expliqué, enregistrement sans réafficher le mot de passe, suppression', async ({ page, request }) => {
    await adminLogin(page);
    await page.getByRole('link', { name: 'Messagerie' }).first().click();
    await expect(page.getByRole('heading', { name: 'Messagerie' })).toBeVisible();
    await expect(page.getByText('Non configurée', { exact: true })).toBeVisible();

    // Gmail by default: the advanced settings stay folded
    await expect(page.getByLabel('Serveur SMTP')).toHaveCount(0);
    await page.getByLabel('Adresse e-mail').fill('Damascino.E2E@Gmail.com');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByLabel("Mot de passe d'application")).toHaveJSProperty('validity.valueMissing', true);

    // the test e-mail explains the failure in plain words (no mail server reachable in the test environment)
    await page.getByLabel("Mot de passe d'application").fill('abcd efgh ijkl mnop');
    await page.getByRole('button', { name: /Paramètres avancés/ }).click();
    await page.getByLabel('Serveur SMTP').fill('127.0.0.1');
    await page.getByLabel('Port').fill('1');
    await page.getByLabel('Envoyer un e-mail de test à').fill('admin@exemple.tn');
    await page.getByRole('button', { name: 'Envoyer un e-mail de test' }).click();
    await expect(page.locator('form').getByRole('alert')).toContainText('Serveur de messagerie injoignable');

    await page.getByLabel('Serveur SMTP').fill('smtp.gmail.com');
    await page.getByLabel('Port').fill('587');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('form').getByRole('status')).toContainText('Messagerie enregistrée');
    await expect(page.getByText('Configurée', { exact: true })).toBeVisible();

    // after reload: the address is shown, the password never comes back
    await page.reload();
    await expect(page.getByLabel('Adresse e-mail')).toHaveValue('damascino.e2e@gmail.com');
    await expect(page.getByLabel("Mot de passe d'application")).toHaveValue('');
    await expect(page.getByLabel("Mot de passe d'application")).toHaveAttribute('placeholder', /enregistré/);
    await expect(page.getByText(/Modifiée le .* par /)).toBeVisible();
    const api = new Api(request);
    const settings = await api.call<Record<string, unknown>>('GET', '/api/mail-settings', await api.admin());
    expect(settings).toMatchObject({ source: 'ADMIN', username: 'damascino.e2e@gmail.com', passwordSet: true });
    expect(JSON.stringify(settings)).not.toContain('abcd');

    // an empty password keeps the saved one
    await page.getByLabel('Adresse e-mail').fill('damascino.e2e2@gmail.com');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.locator('form').getByRole('status')).toContainText('Messagerie enregistrée');

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Supprimer ce compte' }).click();
    await expect(page.locator('form').getByRole('status')).toContainText('Compte de messagerie supprimé');
    await expect(page.getByText('Non configurée', { exact: true })).toBeVisible();
  });

  test('réservé aux administrateurs', async ({ request }) => {
    const api = new Api(request);
    const anonymous = await api.raw('GET', '/api/mail-settings');
    expect(anonymous.status()).toBe(401);
  });
});
