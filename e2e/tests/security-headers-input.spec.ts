import { expect, test } from '@playwright/test';
import { adminLogin, Api, randomPhone, uid } from './support';

test.describe('Sécurité · en-têtes, CSP et filtrage des saisies', () => {
  test('les pages sont servies avec une CSP à nonce et les en-têtes de protection', async ({ request }) => {
    const response = await request.get('/connexion');
    const headers = response.headers();
    const csp = headers['content-security-policy'];
    expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['strict-transport-security']).toContain('max-age=');

    // every script of the page carries the nonce of the policy, a new one on every request
    const nonce = csp.match(/'nonce-([^']+)'/)![1];
    const html = await response.text();
    const scripts = html.match(/<script\b[^>]*>/g) ?? [];
    expect(scripts.length).toBeGreaterThan(0);
    for (const tag of scripts) expect(tag).toContain(`nonce="${nonce}"`);
    const again = (await request.get('/connexion')).headers()['content-security-policy'];
    expect(again).not.toBe(csp);
  });

  test("les réponses de l'API ne peuvent être ni encadrées, ni interprétées, ni mises en cache", async ({ request }) => {
    const response = await request.get('/api/partners/00000000-0000-0000-0000-000000000000/public');
    const headers = response.headers();
    expect(headers['content-security-policy']).toContain("default-src 'none'");
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['cache-control']).toBe('no-store');
  });

  test("aucune violation de la CSP dans les trois espaces", async ({ page }) => {
    const violations: string[] = [];
    page.on('console', (message) => {
      if (/Content Security Policy|Refused to (load|execute|apply)/i.test(message.text())) violations.push(message.text());
    });
    for (const path of ['/', '/connexion', '/personnel', '/hors-ligne']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
    }
    await adminLogin(page);
    for (const path of ['/admin/partenaires', '/admin/beneficiaires', '/admin/caisses', '/admin/rapprochement']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
    }
    expect(violations).toEqual([]);
  });

  test('un script injecté dans une saisie est refusé (API, formulaire et import)', async ({ page, request }) => {
    const api = new Api(request);
    const token = await api.admin();

    const payload = `<img src=x onerror="alert('xss')">`;
    const refused = await api.raw('POST', '/api/partners', token, {
      name: payload,
      conventionStart: '2026-01-01',
      conventionEnd: '2026-12-31',
    });
    expect(refused.status()).toBe(400);
    expect(await refused.json()).toMatchObject({ code: 'VALIDATION_ERROR', fields: { name: 'Contenu non autorisé (balises HTML ou script)' } });

    const partner = await api.createPartner(token);
    const beneficiary = await api.raw('POST', '/api/beneficiaries', token, {
      partnerId: partner.id,
      firstName: '<script>alert(1)</script>',
      lastName: 'Test',
      phone: randomPhone(),
    });
    expect(beneficiary.status()).toBe(400);
    const staff = await api.raw('POST', '/api/accounts', token, { role: 'STAFF', username: `c${uid()}`, displayName: '<b onmouseover=alert(1)>x</b>', secret: '1234' });
    expect(staff.status()).toBe(400);

    // import: the line is skipped with the reason, the other ones are created
    const csv = `Nom;Prénom;Téléphone\nBen Ali;<svg onload=alert(1)>;${randomPhone()}\nTrabelsi;Amel;${randomPhone()}\n`;
    const upload = await request.post(`/api/partners/${partner.id}/beneficiaries/import`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: { file: { name: 'liste.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') } },
    });
    const report = await upload.json();
    expect(report.created).toHaveLength(1);
    expect(report.skipped).toEqual([expect.objectContaining({ line: 2, reason: 'Contenu non autorisé (balises HTML ou script)' })]);

    // form: the error is displayed under the field, nothing is executed
    let dialogOpened = false;
    page.on('dialog', async (d) => {
      dialogOpened = true;
      await d.dismiss();
    });
    await adminLogin(page);
    await page.goto('/admin/partenaires');
    await page.getByRole('button', { name: 'Nouveau partenaire' }).click();
    const dialog = page.getByRole('dialog', { name: 'Nouveau partenaire' });
    await dialog.getByLabel('Nom du partenaire').fill(payload);
    await dialog.getByLabel('Début de convention').fill('2026-01-01');
    await dialog.getByLabel('Fin de convention').fill('2026-12-31');
    await dialog.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(dialog.getByText('Contenu non autorisé (balises HTML ou script)').first()).toBeVisible();
    expect(dialogOpened).toBe(false);
  });

  test("une formule Excel dans un nom est neutralisée dans l'export CSV", async ({ request }) => {
    const api = new Api(request);
    const token = await api.admin();
    const name = `=HYPERLINK("http://evil.example","E2E ${uid()}")`;
    await api.createPartner(token, { name });
    const csv = await (await api.raw('GET', '/api/partners/export?format=csv', token)).text();
    expect(csv).toContain(`'=HYPERLINK(""http://evil.example"",`);
    expect(csv).not.toMatch(/(^|;)=HYPERLINK/m);
  });
});
