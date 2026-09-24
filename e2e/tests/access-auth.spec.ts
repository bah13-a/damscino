import { expect, test } from '@playwright/test';
import { ADMIN, alertIn, Api, uid, uiLogin } from './support';

test.describe('Accès et authentification', () => {
  test("le site renvoie bénéficiaires et personnel vers l'application, l'administration reste sur le web", async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Votre avantage Damascino/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Télécharger pour Android' })).toHaveAttribute('href', /\.apk$|play\.google|releases/);
    await expect(page.getByText("Ouvrez-la, choisissez « Je suis bénéficiaire »")).toBeVisible();
    await page.getByRole('link', { name: 'Personnel Damascino' }).click();
    await expect(page.getByRole('heading', { name: 'Espace personnel' })).toBeVisible();
    await expect(page.getByText('Ouvrez-la, choisissez « Personnel Damascino »')).toBeVisible();
    await page.getByRole('link', { name: 'Administration' }).click();
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });

  test('les anciennes pages bénéficiaire et scanner du site redirigent vers le téléchargement', async ({ page }) => {
    await page.goto('/admin/partenaires');
    await expect(page).toHaveURL(/\/admin\/connexion$/);
    for (const [from, to] of [['/espace', /\/$/], ['/espace/qr', /\/$/], ['/personnel/scanner', /\/personnel$/]] as const) {
      await page.goto(from);
      await expect(page, from).toHaveURL(to);
    }
  });

  test("bénéficiaires et personnel ne peuvent se connecter que depuis l'application", async ({ request }) => {
    const api = new Api(request);
    const staff = await api.createStaff(await api.admin());
    const fromBrowser = await request.post('/api/auth/login', { data: { username: staff.username, password: staff.pin, space: 'STAFF' } });
    expect(fromBrowser.status()).toBe(403);
    expect(await fromBrowser.json()).toMatchObject({ code: 'MOBILE_APP_REQUIRED', message: "Connectez-vous depuis l'application mobile Damascino Privilèges." });
    expect((await api.login('staff', staff.username, staff.pin)).accessToken).toBeTruthy();
  });

  test('un mauvais mot de passe affiche une erreur', async ({ page }) => {
    await uiLogin(page, 'admin', ADMIN.username, 'mauvais-mot-de-passe');
    await expect(alertIn(page)).toHaveText('Identifiant ou mot de passe incorrect');
    await expect(page).toHaveURL(/\/admin\/connexion$/);
  });

  test("un nouvel administrateur doit changer son mot de passe à la première connexion", async ({ page, request }) => {
    const api = new Api(request);
    const username = `admin${uid()}`;
    await api.call('POST', '/api/accounts', await api.admin(), { role: 'ADMIN', username, displayName: 'Admin E2E', secret: 'Provisoire-2026' });

    await uiLogin(page, 'admin', username, 'Provisoire-2026');
    await expect(page).toHaveURL(/\/mot-de-passe\?espace=admin/);
    await expect(page.getByText('Bienvenue Admin E2E')).toBeVisible();

    // confirmation différente
    await page.getByLabel('Mot de passe temporaire').fill('Provisoire-2026');
    await page.getByLabel('Nouveau mot de passe').fill('Nouveau-2026-a');
    await page.getByLabel('Confirmation').fill('Nouveau-2026-b');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(alertIn(page)).toHaveText('Les deux saisies ne correspondent pas.');

    // mot de passe actuel erroné
    await page.getByLabel('Mot de passe temporaire').fill('faux');
    await page.getByLabel('Confirmation').fill('Nouveau-2026-a');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(alertIn(page)).toHaveText('Mot de passe actuel incorrect');

    await page.getByLabel('Mot de passe temporaire').fill('Provisoire-2026');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible();

    // la session reste ouverte au rechargement puis se ferme à la déconnexion
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible();
    await page.getByRole('button', { name: 'Déconnexion' }).click();
    await expect(page).toHaveURL(/\/admin\/connexion$/);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/connexion$/);
  });

  test("le personnel scanner n'a pas accès à l'administration", async ({ page, request }) => {
    const api = new Api(request);
    const staff = await api.createStaff(await api.admin());

    // l'espace admin ne reconnaît pas un compte scanner
    await uiLogin(page, 'admin', staff.username, staff.pin);
    await expect(alertIn(page)).toHaveText('Identifiant ou mot de passe incorrect');

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/connexion$/);

    // et l'API refuse ses jetons sur les routes d'administration
    const token = (await api.login('staff', staff.username, staff.pin)).accessToken;
    for (const path of ['/api/partners', '/api/beneficiaries', '/api/accounts', '/api/reporting/statistics']) {
      expect((await api.raw('GET', path, token)).status(), path).toBe(403);
    }
    expect((await api.raw('GET', '/api/partners')).status()).toBe(401);
  });

  test('le compte est bloqué temporairement après 5 échecs', async ({ page, request }) => {
    const api = new Api(request);
    const staff = await api.createStaff(await api.admin(), '2468');
    for (let i = 0; i < 5; i++) {
      await uiLogin(page, 'staff', staff.username, '0000');
      await expect(alertIn(page)).toHaveText('Identifiant ou mot de passe incorrect');
    }
    await uiLogin(page, 'staff', staff.username, staff.pin);
    await expect(alertIn(page)).toContainText('Compte temporairement bloqué');
  });
});

test("l'application fonctionne quelle que soit son adresse publique (Codespace, Render, tunnel)", async ({ request }) => {
  // the Next.js proxy forwards the Origin of the public address to the gateway: it must not be rejected (403)
  for (const origin of ['https://mon-codespace-3000.app.github.dev', 'https://abc.trycloudflare.com']) {
    const response = await request.post('/api/auth/login', {
      headers: { Origin: origin },
      data: { username: 'admin', password: 'mauvais', space: 'ADMIN' },
    });
    expect(response.status(), origin).toBe(401);
  }
});
