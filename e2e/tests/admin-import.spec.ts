import { expect, test } from '@playwright/test';
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { adminLogin, Api, eventually, randomPhone, readXlsx } from './support';

// Playwright cannot upload from the per-test output folder (its name contains accented characters)
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dp-e2e-'));
const tmp = (name: string) => path.join(dir, name);

/** Uploads a file the way a user does: button, then the file chooser. */
async function upload(page: Page, file: string) {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Choisir un fichier' }).click(),
  ]);
  await chooser.setFiles(file);
}

test.describe("Administration · import des listes et export des accès", () => {
  test('modèle, import CSV avec contrôle des doublons, import Excel et export des accès', async ({ page, request }) => {
    const api = new Api(request);
    const token = await api.admin();
    const partner = await api.createPartner(token);
    const other = await api.createPartner(token);
    const elsewhere = await api.createBeneficiary(token, other.id, 'Salma', 'Ailleurs');

    await adminLogin(page);
    await page.goto(`/admin/partenaires/${partner.id}`);

    // modèle d'import
    const [template] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Télécharger le modèle' }).click()]);
    expect((await readXlsx(await template.path()))[0]).toEqual(['Nom', 'Prénom', 'Téléphone', 'E-mail']);

    // CSV : 2 valides, 1 doublon interne, 1 téléphone invalide, 1 nom manquant, 1 déjà inscrit chez un autre partenaire
    const [p1, p2] = [randomPhone(), randomPhone()];
    const csv = [
      'Nom;Prénom;Téléphone',
      `Ben Salah;Amira;+216 ${p1.slice(0, 2)} ${p1.slice(2, 5)} ${p1.slice(5)}`,
      `Trabelsi;Karim;${p2}`,
      `Doublon;Karim;${p2}`,
      'Court;Numéro;1234',
      `;SansNom;${randomPhone()}`,
      `Ailleurs;Salma;${elsewhere.phone}`,
    ].join('\n');
    const csvPath = tmp('liste.csv');
    fs.writeFileSync(csvPath, '\uFEFF' + csv);
    await upload(page, csvPath);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('2 bénéficiaire(s) créé(s) sur 6 ligne(s)')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('4 ligne(s) ignorée(s)')).toBeVisible();
    await expect(page.getByText('Doublon dans le fichier')).toBeVisible();
    await expect(page.getByText('Téléphone invalide (8 chiffres attendus)')).toBeVisible();
    await expect(page.getByText('Nom ou prénom manquant')).toBeVisible();
    await expect(page.getByText(`Déjà enregistré chez ${other.name}`)).toBeVisible();
    await expect(page.getByText('2 bénéficiaire(s)', { exact: true })).toBeVisible();

    // réimport du même fichier : tout est déjà enregistré pour ce partenaire
    await upload(page, csvPath);
    await expect(page.getByText('0 bénéficiaire(s) créé(s) sur 6 ligne(s)')).toBeVisible();
    await expect(page.getByText('Déjà enregistré pour ce partenaire').first()).toBeVisible();

    // Excel
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Liste');
    sheet.addRow(['Prénom', 'Nom', 'Tél']);
    const p3 = randomPhone();
    sheet.addRow(['Nour', 'Gharbi', Number(p3)]);
    const xlsxPath = tmp('liste.xlsx');
    await workbook.xlsx.writeFile(xlsxPath);
    await upload(page, xlsxPath);
    await expect(page.getByText('1 bénéficiaire(s) créé(s) sur 1 ligne(s)')).toBeVisible();

    // fichier sans les colonnes attendues
    const badPath = tmp('mauvais.csv');
    fs.writeFileSync(badPath, 'a;b\n1;2\n');
    await upload(page, badPath);
    await expect(page.getByRole('alert').filter({ hasText: 'Colonnes attendues' })).toBeVisible();

    // export des accès : identifiant + mot de passe temporaire tant que le compte n'est pas activé
    const [accesses] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exporter les accès' }).click()]);
    expect(path.extname(accesses.suggestedFilename())).toBe('.xlsx');
    const rows = await readXlsx(await accesses.path());
    expect(rows[0]).toEqual(['Nom', 'Prénom', 'Identifiant (téléphone)', 'Mot de passe temporaire', 'Statut']);
    expect(rows).toHaveLength(4);
    const amira = rows.find((r) => r[2] === p1)!;
    expect(amira[3]).toMatch(/^[A-Za-z2-9]{10}$/);
    expect(amira[4]).toContain('À activer');

    // le mot de passe exporté permet la première connexion, puis disparaît de l'export une fois activé
    await api.activate({ beneficiaryId: '', firstName: 'Amira', lastName: 'Ben Salah', phone: p1, temporaryPassword: amira[3] });
    await eventually(async () => {
      const [again] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exporter les accès' }).click()]);
      const row = (await readXlsx(await again.path())).find((r) => r[2] === p1)!;
      expect(row[3]).toBe('');
      expect(row[4]).toContain('Compte activé le');
    });
  });
});
