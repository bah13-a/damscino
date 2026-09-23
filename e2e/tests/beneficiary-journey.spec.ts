import { expect, test } from '@playwright/test';
import { alertIn, Api, beneficiaryLogin, eventually, readyBeneficiary, shiftDays, uid, uiLogin } from './support';

test.describe('Espace bénéficiaire', () => {
  test('première connexion : changement du mot de passe puis espace personnel', async ({ page, request }) => {
    const api = new Api(request);
    const admin = await api.admin();
    const partner = await api.createPartner(admin);
    const credentials = await api.createBeneficiary(admin, partner.id, 'Amira', `BenSalah${uid()}`);

    // identifiant saisi avec indicatif et espaces
    const formatted = `+216 ${credentials.phone.slice(0, 2)} ${credentials.phone.slice(2, 5)} ${credentials.phone.slice(5)}`;
    await page.goto('/connexion');
    await expect(page.getByText('Mot de passe oublié ?')).toBeVisible();
    await page.getByLabel('Identifiant (numéro de téléphone)').fill(formatted);
    await page.getByLabel('Mot de passe').fill('mauvais');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(alertIn(page)).toHaveText('Identifiant ou mot de passe incorrect');

    await eventually(() => api.login('beneficiary', credentials.phone, credentials.temporaryPassword));
    await page.getByLabel('Mot de passe').fill(credentials.temporaryPassword);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/mot-de-passe\?espace=beneficiary/);
    await expect(page.getByText(`Bienvenue Amira ${credentials.lastName}`)).toBeVisible();

    // l'espace reste fermé tant que le mot de passe n'est pas changé
    await page.goto('/espace');
    await expect(page).toHaveURL(/\/mot-de-passe\?espace=beneficiary/);

    await page.getByLabel('Mot de passe temporaire').fill(credentials.temporaryPassword);
    // trop court : bloqué par le formulaire (8 caractères minimum)
    await page.getByLabel('Nouveau mot de passe').fill('court');
    await page.getByLabel('Confirmation').fill('court');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page).toHaveURL(/\/mot-de-passe/);
    expect(await page.getByLabel('Nouveau mot de passe').evaluate((el: HTMLInputElement) => el.validity.tooShort)).toBe(true);

    await page.getByLabel('Nouveau mot de passe').fill('amira-2026!');
    await page.getByLabel('Confirmation').fill('amira-2026!');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page).toHaveURL(/\/espace$/);

    await expect(page.getByText(`Amira ${credentials.lastName}`)).toBeVisible();
    await expect(page.getByText(partner.name)).toBeVisible();
    await expect(page.getByText('Disponible')).toBeVisible();
    await expect(page.getByText('−20 %')).toBeVisible();
    await expect(page.getByText('sur un plat éligible par jour')).toBeVisible();
    await expect(page.getByText('Éligible : Plats · Exclus : Boissons, Desserts')).toBeVisible();
    await expect(page.getByText('Aucun passage pour le moment.')).toBeVisible();
    await expect(page.getByText(/Convention valable jusqu'au/)).toBeVisible();

    // la session est conservée (application rouverte) puis fermée à la déconnexion
    await page.reload();
    await expect(page.getByText('Disponible')).toBeVisible();
    await page.getByRole('button', { name: 'Déconnexion' }).click();
    await expect(page).toHaveURL(/\/connexion$/);

    // l'ancien mot de passe temporaire ne fonctionne plus, le nouveau oui
    expect((await api.raw('POST', '/api/auth/login', undefined, { username: credentials.phone, password: credentials.temporaryPassword, space: 'BENEFICIARY' })).status()).toBe(401);
    await beneficiaryLogin(page, credentials.phone, 'amira-2026!');
  });

  test('le QR code du jour se renouvelle toutes les 30 secondes', async ({ page, request }) => {
    test.slow();
    const api = new Api(request);
    const b = await readyBeneficiary(api);
    await eventually(() => api.qr(b.auth.accessToken)); // compte connu du service privilèges
    await beneficiaryLogin(page, b.credentials.phone, b.password);

    const tokens: string[] = [];
    page.on('response', async (response) => {
      if (response.url().endsWith('/api/privileges/qr') && response.ok()) tokens.push((await response.json()).token);
    });
    await page.getByRole('link', { name: 'Utiliser mon avantage' }).click();
    await expect(page).toHaveURL(/\/espace\/qr$/);
    await expect(page.getByText(b.fullName)).toBeVisible();
    await expect(page.getByText(b.partner.name)).toBeVisible();
    await expect(page.locator('main svg').first()).toBeVisible();
    await expect(page.getByText(/nouveau code dans \d+s/)).toBeVisible();
    await expect(page.getByText("Valable pour un seul plat éligible. Les captures d'écran ne fonctionnent pas.")).toBeVisible();

    await expect.poll(() => tokens.length, { timeout: 45_000 }).toBeGreaterThanOrEqual(2);
    expect(tokens[1]).not.toBe(tokens[0]);
    expect(tokens[0]).toMatch(/^DP1\.[\w-]+\.[\w-]+$/);

    await page.getByRole('link', { name: '← Retour' }).click();
    await expect(page).toHaveURL(/\/espace$/);
  });

  test("une connexion sur un autre appareil ferme la session précédente", async ({ page, browser, request }) => {
    const api = new Api(request);
    const b = await readyBeneficiary(api);
    await eventually(() => api.qr(b.auth.accessToken));
    await beneficiaryLogin(page, b.credentials.phone, b.password);
    await page.getByRole('link', { name: 'Utiliser mon avantage' }).click();
    await expect(page.getByText(/nouveau code dans/)).toBeVisible();

    const otherDevice = await browser.newContext({ ...test.info().project.use });
    const other = await otherDevice.newPage();
    await beneficiaryLogin(other, b.credentials.phone, b.password);
    await expect(other.getByText('Disponible')).toBeVisible();

    // l'écran QR resté ouvert sur l'ancien appareil est fermé dans les secondes qui suivent
    await expect(page).toHaveURL(/\/connexion\?expire=1$/, { timeout: 20_000 });
    await expect(page.getByText("Votre session a expiré ou votre compte s'est connecté sur un autre appareil.")).toBeVisible();
    await otherDevice.close();
  });

  test('avantage indisponible hors convention ou partenaire désactivé', async ({ page, request }) => {
    const api = new Api(request);

    const future = await readyBeneficiary(api, { conventionStart: shiftDays(10), conventionEnd: shiftDays(100) });
    await beneficiaryLogin(page, future.credentials.phone, future.password);
    await expect(page.getByText(/La convention commence le/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Avantage indisponible' })).toBeDisabled();
    await page.getByRole('button', { name: 'Déconnexion' }).click();

    const past = await readyBeneficiary(api, { conventionStart: shiftDays(-100), conventionEnd: shiftDays(-1) });
    await beneficiaryLogin(page, past.credentials.phone, past.password);
    await expect(page.getByText('Convention expirée')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Utiliser mon avantage' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Déconnexion' }).click();

    const running = await readyBeneficiary(api);
    await api.call('PATCH', `/api/partners/${running.partner.id}/status`, running.admin, { active: false });
    await eventually(async () => {
      const response = await api.raw('POST', '/api/privileges/qr', running.auth.accessToken);
      expect((await response.json()).code).toBe('PARTNER_INACTIVE');
    });
    await beneficiaryLogin(page, running.credentials.phone, running.password);
    await expect(page.getByText('Convention expirée')).toBeVisible();
  });

  test('un bénéficiaire désactivé ne peut plus se connecter', async ({ page, request }) => {
    const api = new Api(request);
    const b = await readyBeneficiary(api);
    await api.call('PATCH', `/api/beneficiaries/${b.credentials.beneficiaryId}/status`, b.admin, { active: false });
    await eventually(async () => {
      const response = await api.raw('POST', '/api/auth/login', undefined, { username: b.credentials.phone, password: b.password, space: 'BENEFICIARY' });
      expect(response.status()).toBe(403);
    });
    await uiLogin(page, 'beneficiary', b.credentials.phone, b.password);
    await expect(alertIn(page)).toHaveText('Ce compte est désactivé. Contactez Damascino.');
  });
});
