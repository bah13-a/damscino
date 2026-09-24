import { expect, test } from '@playwright/test';
import ExcelJS from 'exceljs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { adminLogin, Api, DEFAULT_TILL_SETTINGS, eventually, readText, readyBeneficiary, setTillSettings, uid } from './support';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dp-recon-'));

/** Tunis wall-clock parts of an instant. */
function tunis(iso: string, plusMinutes = 0) {
  const date = new Date(new Date(iso).getTime() + plusMinutes * 60_000);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Tunis', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return { day: `${parts.day}/${parts.month}/${parts.year}`, time: `${parts.hour}:${parts.minute}`, parts };
}

test.describe('Rapprochement des remises de la caisse', () => {
  test.beforeAll(async ({ request }) => {
    const api = new Api(request);
    await setTillSettings(api, await api.admin(), DEFAULT_TILL_SETTINGS);
  });

  test("export de la caisse (CSV puis Excel) comparé aux passages validés", async ({ page, request }) => {
    const api = new Api(request);
    const admin = await api.admin();
    const staff = await api.createStaff(admin);
    const staffToken = (await api.login('staff', staff.username, staff.pin)).accessToken;

    // 4 passages validés à la tablette (montants choisis pour ne croiser aucun autre test)
    const passages: { name: string; code: string; amount: number; at: string }[] = [];
    for (const price of [43, 31, 37, 50]) {
      const b = await readyBeneficiary(api);
      const confirmed = await api.confirm(staffToken, (await api.qr(b.auth.accessToken)).token, price);
      passages.push({ name: b.fullName, code: confirmed.validationCode!, amount: confirmed.discountAmount!, at: '' });
    }
    // heure de validation telle qu'enregistrée
    await eventually(async () => {
      const usages = await api.call<{ items: { beneficiaryName: string; validatedAt: string }[] }>('GET', '/api/reporting/usages?size=200', admin);
      for (const p of passages) {
        const row = usages.items.find((u) => u.beneficiaryName === p.name);
        expect(row).toBeTruthy();
        p.at = row!.validatedAt;
      }
    });
    const [p1, p2, p3, p4] = passages; // p3 : oublié en caisse
    const t = (i: number, plus = 0) => tunis(passages[i].at, plus);

    const suffix = uid();
    const rows = [
      ['N° Ticket', 'Date', 'Heure', 'Caissier', 'Total TTC', 'Libellé remise', 'Montant remise', 'Commentaire'],
      [`A-${suffix}`, t(0).day, t(0).time, 'Sami', '51,000', 'Damascino Privilèges', '8,600', `code ${p1.code}`],
      [`B-${suffix}`, t(1).day, t(1, 2).time, 'Sami', '40,000', 'Damascino Privilèges', '6,200', ''],
      [`C-${suffix}`, t(1).day, t(1, 5).time, 'Mehdi', '60,000', 'Damascino Privilèges', '9,900', ''],
      [`D-${suffix}`, t(1).day, t(1).time, 'Sami', '30,000', 'Happy hour', '5,000', ''],
      [`E-${suffix}`, t(1).day, t(1).time, 'Sami', '22,000', '', '', ''],
      [`F-${suffix}`, t(3).day, t(3).time, 'Sami', '70,000', 'DAMASCINO privileges', '12,000', p4.code],
      [`G-${suffix}`, 'hier', '12:00', 'Sami', '10,000', 'Damascino Privilèges', '2,000', ''],
    ];
    const csv = path.join(dir, `ventes-${suffix}.csv`);
    fs.writeFileSync(csv, rows.map((r) => r.join(';')).join('\r\n'));

    await adminLogin(page);
    await page.getByRole('link', { name: 'Rapprochement' }).first().click();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: "Choisir l'export" }).click()]);
    await chooser.setFiles(csv);
    await expect(page.getByText(`ventes-${suffix}.csv · 7 ligne(s)`)).toBeVisible();

    // colonnes reconnues automatiquement
    await expect(page.getByLabel('Montant de la remise *')).toHaveValue('6');
    await expect(page.getByLabel('Libellé de la remise')).toHaveValue('5');
    await expect(page.getByLabel('Commentaire / référence')).toHaveValue('7');
    await expect(page.getByLabel('Date', { exact: true })).toHaveValue('1');
    await expect(page.getByLabel('Heure', { exact: true })).toHaveValue('2');
    await expect(page.getByLabel('Nom de la remise Damascino')).toHaveValue('Damascino Privilèges');
    // short tolerance: the database may hold passages of other tests validated without price around the same time
    await page.getByLabel('Tolérance horaire (minutes)').fill('3');

    await page.getByRole('button', { name: '3. Lancer le rapprochement' }).click();
    const kpi = (label: string) => page.locator('div.rounded-2xl', { has: page.getByText(label, { exact: true }) }).first();
    await expect(kpi('Remises en caisse')).toContainText('4 · 36,7 DT');
    await expect(kpi('Rapprochés')).toContainText('3');
    await expect(kpi('Écarts de montant')).toContainText('1');
    await expect(kpi('Remises sans passage')).toContainText('1');
    await expect(kpi('Lignes illisibles')).toContainText('1');

    // remise saisie en caisse sans QR validé
    await expect(page.getByRole('row', { name: new RegExp(`C-${suffix}`) })).toContainText('Mehdi');
    await expect(page.getByRole('row', { name: new RegExp(`C-${suffix}`) })).toContainText('9,9 DT');
    // QR validé mais oublié en caisse
    await expect(page.getByRole('row', { name: new RegExp(p3.name) })).toContainText(p3.code);
    // écart : 12 DT saisis pour 10 DT validés
    await expect(page.getByRole('row', { name: new RegExp(`F-${suffix}`) })).toContainText('+2 DT');

    await page.getByText(/^Rapprochés \(3\)$/).click();
    await expect(page.getByRole('row', { name: new RegExp(`A-${suffix}`) })).toContainText('Code de validation');
    await expect(page.getByRole('row', { name: new RegExp(`B-${suffix}`) })).toContainText('Heure et montant');

    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exporter les anomalies (CSV)' }).click()]);
    const anomalies = readText(await download.path());
    expect(anomalies).toContain('Remise en caisse sans passage validé');
    expect(anomalies).toContain(`"${p3.name}"`);
    expect(anomalies).toContain('Écart de montant');

    // même export au format Excel, avec de vraies cellules date/heure
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Ventes');
    sheet.addRow(['Ticket', 'Date et heure', 'Remise', 'Libellé remise', 'Observation']);
    const cell = (i: number, plus = 0) => {
      const { parts } = t(i, plus);
      return new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute));
    };
    sheet.addRow([`A-${suffix}`, cell(0), 8.6, 'Damascino Privilèges', p1.code]);
    sheet.addRow([`B-${suffix}`, cell(1, 1), 6.2, 'Damascino Privilèges', '']);
    sheet.getColumn(2).numFmt = 'dd/mm/yyyy hh:mm';
    const xlsx = path.join(dir, `ventes-${suffix}.xlsx`);
    await workbook.xlsx.writeFile(xlsx);

    const [chooser2] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: "Choisir l'export" }).click()]);
    await chooser2.setFiles(xlsx);
    await expect(page.getByLabel('Date et heure')).toHaveValue('1');
    await expect(page.getByLabel('Montant de la remise *')).toHaveValue('2');
    await page.getByRole('button', { name: '3. Lancer le rapprochement' }).click();
    await expect(kpi('Remises en caisse')).toContainText('2 · 14,8 DT');
    await expect(kpi('Rapprochés')).toContainText('2');
    await expect(kpi('Remises sans passage')).toContainText('0');
  });

  test('paramètres de la remise en caisse', async ({ page, request }) => {
    await adminLogin(page);
    await page.goto('/admin/caisses');
    await expect(page.getByRole('heading', { name: 'Remise saisie dans la caisse' })).toBeVisible();
    await page.getByLabel('Comment la caisse applique la remise').selectOption('TICKET_AMOUNT');
    await expect(page.getByText('En montant sur le ticket, rendez le prix obligatoire')).toBeVisible();
    await page.getByLabel('Prix du plat obligatoire sur la tablette').check();
    await page.getByLabel('Nom de la remise dans la caisse').fill('Remise DP');
    await page.getByRole('button', { name: 'Enregistrer' }).first().click();
    await expect(page.getByText('Paramètres enregistrés')).toBeVisible();

    const api = new Api(request);
    const admin = await api.admin();
    expect(await api.call('GET', '/api/privileges/settings', admin)).toMatchObject({ discountLabel: 'Remise DP', applyMode: 'TICKET_AMOUNT', priceRequired: true });
    await setTillSettings(api, admin, DEFAULT_TILL_SETTINGS);
  });
});
