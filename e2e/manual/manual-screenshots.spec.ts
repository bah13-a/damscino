import { chromium, devices, expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Api, readXlsx } from '../tests/support';

/**
 * Screenshots of docs/manuel/MANUEL_UTILISATION.md, taken on a fresh database with demonstration data.
 * Run: npx playwright test -c playwright.manual.config.ts
 */

const IMG = path.resolve(__dirname, '../../docs/manuel/img');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'dp-manual-'));
const INITIAL_PASSWORD = process.env.E2E_ADMIN_INITIAL_PASSWORD ?? 'Damascino2026!';
const ADMIN_PASSWORD = 'Damascino-Demo-2026';

async function shot(page: Page, name: string, fullPage = false) {
  await page.mouse.move(0, 0); // no hover tooltip
  await page.waitForTimeout(500);
  const viewport = page.viewportSize()!;
  if (fullPage) {
    // grow the viewport instead of Playwright's full-page capture, which misplaces the sticky admin menu
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: viewport.width, height: Math.max(height, viewport.height) });
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: path.join(IMG, `${name}.png`) });
  if (fullPage) await page.setViewportSize(viewport);
}

async function login(page: Page, loginPath: string, userLabel: string, user: string, secretLabel: string, secret: string) {
  await page.goto(loginPath);
  await page.getByLabel(userLabel).fill(user);
  await page.getByLabel(secretLabel).fill(secret);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

const phoneOf = (i: number) => `98${String(100000 + i * 1111).slice(-6)}`;

const MALL_LIST = [
  ['Ben Salah', 'Amira', phoneOf(1)],
  ['Trabelsi', 'Karim', phoneOf(2)],
  ['Gharbi', 'Nour', phoneOf(3)],
  ['Jlassi', 'Mehdi', phoneOf(4)],
  ['Haddad', 'Salma', phoneOf(5)],
  ['Doublon', 'Karim', phoneOf(2)],
  ['Masmoudi', 'Yassine', '123'],
];

test('captures du manuel d’utilisation', async ({ request }) => {
  fs.mkdirSync(IMG, { recursive: true });
  const api = new Api(request);
  const baseURL = test.info().project.use.baseURL;
  const browser: Browser = await chromium.launch();
  const desktop: BrowserContext = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 }, locale: 'fr-FR', timezoneId: 'Africa/Tunis' });
  const admin = await desktop.newPage();

  // ─── Administration : première connexion ─────────────────────────────────────────────
  await admin.goto('/');
  await login(admin, '/admin/connexion', 'Identifiant', 'admin', 'Mot de passe', INITIAL_PASSWORD);
  await expect(admin).toHaveURL(/mot-de-passe/);
  await admin.getByLabel('Mot de passe temporaire').fill(INITIAL_PASSWORD);
  await admin.getByLabel('Nouveau mot de passe').fill(ADMIN_PASSWORD);
  await admin.getByLabel('Confirmation').fill(ADMIN_PASSWORD);
  await shot(admin, 'admin-01-premier-mot-de-passe');
  await admin.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(admin).toHaveURL(/\/admin$/);
  const token = (await api.login('admin', 'admin', ADMIN_PASSWORD)).accessToken;

  // ─── Comptes du personnel ────────────────────────────────────────────────────────────
  await admin.goto('/admin/comptes');
  await admin.getByRole('button', { name: 'Nouveau compte' }).click();
  const account = admin.getByRole('dialog', { name: 'Nouveau compte' });
  await account.getByLabel('Identifiant').fill('sami');
  await account.getByLabel('Nom affiché').fill('Sami (caisse 1)');
  await account.getByLabel('Code PIN').fill('2468');
  await shot(admin, 'admin-02-nouveau-compte-scanner');
  await account.getByRole('button', { name: 'Créer le compte' }).click();
  await api.call('POST', '/api/accounts', token, { role: 'STAFF', username: 'lina', displayName: 'Lina (caisse 2)', secret: '1357' });
  await admin.reload();
  await expect(admin.getByText('Lina (caisse 2)')).toBeVisible();
  await shot(admin, 'admin-03-comptes');

  // ─── Catégories ──────────────────────────────────────────────────────────────────────
  await admin.goto('/admin/categories');
  await admin.getByLabel('Libellé').fill('Grillades');
  await admin.getByRole('button', { name: 'Ajouter' }).click();
  await expect(admin.getByText('GRILLADES')).toBeVisible();
  await shot(admin, 'admin-04-categories');

  // ─── Partenaires ─────────────────────────────────────────────────────────────────────
  await admin.goto('/admin/partenaires');
  await admin.getByRole('button', { name: 'Nouveau partenaire' }).click();
  const partnerForm = admin.getByRole('dialog', { name: 'Nouveau partenaire' });
  await partnerForm.getByLabel('Nom du partenaire').fill('Mall of Sfax');
  await partnerForm.getByLabel('Début de convention').fill('2026-01-01');
  await partnerForm.getByLabel('Fin de convention').fill('2026-12-31');
  await partnerForm.getByLabel('Contact', { exact: true }).fill('Mme Rania Kallel (RH)');
  await partnerForm.getByLabel('Téléphone du contact').fill('74 400 400');
  await partnerForm.getByLabel('E-mail du contact').fill('rh@mallofsfax.tn');
  await shot(admin, 'admin-05-nouveau-partenaire');
  await partnerForm.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(admin.getByRole('heading', { name: 'Mall of Sfax' })).toBeVisible();
  const mallId = admin.url().split('/').pop()!;

  await admin.getByRole('button', { name: 'Modifier' }).nth(1).click();
  await admin.getByRole('dialog', { name: "Règle d'avantage" }).locator('div', { hasText: /^Grillades/ }).getByRole('button', { name: 'Éligible' }).click();
  await shot(admin, 'admin-06-regle-avantage');
  await admin.getByRole('dialog').getByRole('button', { name: 'Enregistrer la règle' }).click();
  await expect(admin.getByText('Éligibles : Grillades, Plats')).toBeVisible();

  // ─── Import de la liste ──────────────────────────────────────────────────────────────
  const csv = path.join(TMP, 'liste-mall-of-sfax.csv');
  fs.writeFileSync(csv, '﻿Nom;Prénom;Téléphone\n' + MALL_LIST.map((r) => r.join(';')).join('\n'));
  const [chooser] = await Promise.all([admin.waitForEvent('filechooser'), admin.getByRole('button', { name: 'Choisir un fichier' }).click()]);
  await chooser.setFiles(csv);
  await expect(admin.getByText('5 bénéficiaire(s) créé(s) sur 7 ligne(s)')).toBeVisible();
  await shot(admin, 'admin-07-import-liste', true);

  const [accesses] = await Promise.all([admin.waitForEvent('download'), admin.getByRole('button', { name: 'Exporter les accès' }).click()]);
  const accessRows = await readXlsx(await accesses.path());
  const temp = (phone: string) => accessRows.find((r) => r[2] === phone)![3];

  // second partner and its members (API)
  const mokador = await api.call<{ id: string }>('POST', '/api/partners', token, {
    name: 'Famille Mokador', contactName: 'M. Hatem Mokador', conventionStart: '2026-03-01', conventionEnd: '2027-02-28',
  });
  const mokadorMembers = [['Mokador', 'Leila'], ['Mokador', 'Sami'], ['Mokador', 'Ines']].map(([last, first], i) => ({ last, first, phone: phoneOf(20 + i) }));
  const mokadorAccess: Record<string, string> = {};
  for (const m of mokadorMembers) {
    const c = await api.call<{ temporaryPassword: string }>('POST', '/api/beneficiaries', token, { partnerId: mokador.id, firstName: m.first, lastName: m.last, phone: m.phone });
    mokadorAccess[m.phone] = c.temporaryPassword;
  }

  // a few past passages for the statistics
  const staffToken = (await api.login('staff', 'sami', '2468')).accessToken;
  const linaToken = (await api.login('staff', 'lina', '1357')).accessToken;
  for (const [phone, password, price, who] of [
    [phoneOf(2), temp(phoneOf(2)), 38, staffToken],
    [phoneOf(3), temp(phoneOf(3)), 42, linaToken],
    [phoneOf(4), temp(phoneOf(4)), 35, staffToken],
    [phoneOf(20), mokadorAccess[phoneOf(20)], 45, linaToken],
    [phoneOf(21), mokadorAccess[phoneOf(21)], 29, staffToken],
  ] as const) {
    const auth = await api.activate({ beneficiaryId: '', firstName: '', lastName: '', phone, temporaryPassword: password }, 'Demo-2026-pass');
    await api.confirm(who, (await api.qr(auth.accessToken)).token, price);
  }

  // ─── Espace bénéficiaire (iPhone) ────────────────────────────────────────────────────
  const phone = await browser.newContext({ ...devices['iPhone 13'], baseURL, locale: 'fr-FR', timezoneId: 'Africa/Tunis' });
  const amira = await phone.newPage();
  await amira.goto('/');
  await shot(amira, 'benef-01-accueil');
  await amira.goto(`/connexion?p=${mallId}`);
  await amira.getByLabel('Identifiant (numéro de téléphone)').fill(phoneOf(1).replace(/(\d{2})(\d{3})(\d{3})/, '$1 $2 $3'));
  await amira.getByLabel('Mot de passe').fill(temp(phoneOf(1)));
  await expect(amira.getByText('Bienvenue aux collaborateurs de Mall of Sfax')).toBeVisible();
  await shot(amira, 'benef-02-connexion');
  await amira.getByRole('button', { name: 'Se connecter' }).click();
  await expect(amira).toHaveURL(/mot-de-passe/);
  await amira.getByLabel('Mot de passe temporaire').fill(temp(phoneOf(1)));
  await amira.getByLabel('Nouveau mot de passe').fill('amira-2026!');
  await amira.getByLabel('Confirmation').fill('amira-2026!');
  await shot(amira, 'benef-03-nouveau-mot-de-passe');
  await amira.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(amira.getByText('Disponible')).toBeVisible();
  await shot(amira, 'benef-04-espace', true);
  const qrTokens: string[] = [];
  amira.on('response', async (r) => {
    if (r.url().endsWith('/api/privileges/qr') && r.ok()) qrTokens.push((await r.json()).token);
  });
  await amira.getByRole('link', { name: 'Utiliser mon avantage' }).click();
  await expect(amira.getByText(/nouveau code dans/)).toBeVisible();
  await expect.poll(() => qrTokens.length).toBeGreaterThan(0);
  await shot(amira, 'benef-05-qr-code');
  const amiraToken = qrTokens[qrTokens.length - 1];

  // ─── Espace personnel (tablette / téléphone de caisse) ──────────────────────────────
  const staffBrowser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const staffContext = await staffBrowser.newContext({ ...devices['Pixel 7'], baseURL, permissions: ['camera'], locale: 'fr-FR', timezoneId: 'Africa/Tunis' });
  const till = await staffContext.newPage();
  await till.goto('/personnel');
  await till.getByLabel('Identifiant').fill('sami');
  await till.getByLabel('Code PIN').fill('2468');
  await shot(till, 'staff-01-connexion');
  await till.getByRole('button', { name: 'Se connecter' }).click();
  await expect(till.getByRole('heading', { name: 'Scanner le QR code du client' })).toBeVisible();
  await till.waitForTimeout(2500);
  await shot(till, 'staff-02-scanner');
  await till.getByText('Saisie manuelle du code').click();
  await till.getByPlaceholder('DP1…').fill(amiraToken);
  await till.getByRole('button', { name: 'Vérifier' }).click();
  await expect(till.getByRole('heading', { name: 'Avantage valide' })).toBeVisible();
  await till.getByLabel(/Prix du plat remisé/).fill('40');
  await shot(till, 'staff-03-avantage-valide', true);
  await till.getByRole('button', { name: 'Confirmer le passage' }).click();
  await expect(till.getByTestId('till-instructions')).toBeVisible();
  await shot(till, 'staff-04-passage-valide', true);
  await expect(amira.getByRole('heading', { name: 'Avantage utilisé' })).toBeVisible({ timeout: 15_000 });
  await shot(amira, 'benef-06-avantage-utilise');
  await amira.getByRole('link', { name: 'Terminer' }).click();
  await expect(amira.getByText("Déjà utilisé aujourd'hui")).toBeVisible();
  await shot(amira, 'benef-07-deja-utilise', true);

  await till.getByRole('button', { name: 'Scanner un autre client' }).click();
  await till.getByText('Saisie manuelle du code').click();
  await till.getByPlaceholder('DP1…').fill(amiraToken);
  await till.getByRole('button', { name: 'Vérifier' }).click();
  await expect(till.getByRole('heading', { name: 'Refusé' })).toBeVisible();
  await shot(till, 'staff-05-refuse');

  // ─── Administration : suivi ─────────────────────────────────────────────────────────
  await admin.waitForTimeout(3000); // reporting projections
  await admin.goto('/admin');
  await expect(admin.getByText('Par partenaire')).toBeVisible();
  await shot(admin, 'admin-08-tableau-de-bord', true);
  await admin.goto('/admin/partenaires');
  await shot(admin, 'admin-09-partenaires');
  await admin.goto(`/admin/partenaires/${mallId}`);
  await expect(admin.getByRole('row', { name: /Ben Salah/ })).toBeVisible();
  await shot(admin, 'admin-10-fiche-partenaire', true);

  await admin.goto('/admin/beneficiaires');
  await expect(admin.getByText(/bénéficiaire\(s\)/)).toBeVisible();
  await shot(admin, 'admin-11-beneficiaires');
  admin.once('dialog', (d) => d.accept());
  await admin.getByRole('row', { name: /Haddad/ }).getByRole('button', { name: 'Réinitialiser' }).click();
  await expect(admin.getByRole('dialog', { name: 'Accès généré' })).toBeVisible();
  await shot(admin, 'admin-12-acces-genere');
  await admin.getByRole('dialog').getByRole('button', { name: 'Fermer' }).first().click();
  await admin.getByRole('row', { name: /Ben Salah/ }).getByRole('button', { name: 'Historique' }).click();
  await expect(admin.getByRole('dialog').getByText('validé par Sami (caisse 1)')).toBeVisible();
  await shot(admin, 'admin-13-historique');
  await admin.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click();

  await admin.goto('/admin/utilisations');
  await expect(admin.getByText(/passage\(s\)/)).toBeVisible();
  await shot(admin, 'admin-14-utilisations');
  await admin.getByRole('button', { name: 'Refus' }).click();
  await expect(admin.getByText('QR déjà utilisé')).toBeVisible();
  await shot(admin, 'admin-15-refus');

  await admin.goto('/admin/caisses');
  await expect(admin.getByRole('heading', { name: 'Remise saisie dans la caisse' })).toBeVisible();
  await shot(admin, 'admin-16-remise-en-caisse');

  // till export of the day: every passage entered, except one forgotten, plus one discount without QR
  const usages = await api.call<{ items: { validatedAt: string; discountAmount: number; validationCode: string; beneficiaryName: string }[] }>('GET', '/api/reporting/usages?size=50', token);
  const fmt = (iso: string, plus = 0) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Tunis', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(new Date(iso).getTime() + plus * 60_000)).map((x) => [x.type, x.value]));
    return `${p.day}/${p.month}/${p.year};${p.hour}:${p.minute}`;
  };
  const lines = ['N° Ticket;Date;Heure;Caissier;Total TTC;Libellé remise;Montant remise;Commentaire'];
  usages.items.slice(1).forEach((u, i) => {
    lines.push(`T-10${i + 1};${fmt(u.validatedAt, 2)};Sami;${(u.discountAmount * 5 + 12).toFixed(3).replace('.', ',')};Damascino Privilèges;${u.discountAmount.toFixed(3).replace('.', ',')};${i % 2 ? '' : u.validationCode}`);
  });
  lines.push(`T-199;${fmt(usages.items[0].validatedAt, 25)};Lina;64,000;Damascino Privilèges;9,000;`);
  lines.push(`T-200;${fmt(usages.items[0].validatedAt, 30)};Lina;18,000;Happy hour;3,000;`);
  const tillExport = path.join(TMP, 'ventes-du-jour.csv');
  fs.writeFileSync(tillExport, '﻿' + lines.join('\r\n'));
  await admin.goto('/admin/rapprochement');
  const [chooser2] = await Promise.all([admin.waitForEvent('filechooser'), admin.getByRole('button', { name: "Choisir l'export" }).click()]);
  await chooser2.setFiles(tillExport);
  await expect(admin.getByLabel('Montant de la remise *')).toHaveValue('6');
  await shot(admin, 'admin-17-rapprochement-colonnes', true);
  await admin.getByRole('button', { name: '3. Lancer le rapprochement' }).click();
  await expect(admin.getByText(/Résultat du/)).toBeVisible();
  await admin.getByText(/^Rapprochés \(/).click();
  await shot(admin, 'admin-18-rapprochement-resultat', true);

  await admin.goto('/admin/journal');
  await expect(admin.getByText('Import de liste')).toBeVisible();
  await shot(admin, 'admin-19-journal');

  await staffBrowser.close();
  await browser.close();
});
