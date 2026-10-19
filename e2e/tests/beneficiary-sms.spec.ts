import { expect, test } from '@playwright/test';
import { alertIn, Api, eventually, randomPhone, uid, WEB_URL } from './support';

/** Activation of beneficiaries by SMS code (test environment: the code is shown in the app instead of being sent). */
test.describe('Application · activation par SMS', () => {
  test("avec un e-mail sur la liste du partenaire, le code part par e-mail (le SMS n'est qu'un secours)", async ({ page, request }) => {
    const api = new Api(request);
    const admin = await api.admin();
    const partner = await api.createPartner(admin);
    const lastName = `Mail${uid()}`;
    const credentials = await api.createBeneficiary(admin, partner.id, 'Sarra', lastName, `Sarra.${lastName}@Exemple.tn`);
    await eventually(() => api.login('beneficiary', credentials.phone, credentials.temporaryPassword));

    await page.goto(`/connexion?p=${partner.id}`);
    await page.getByLabel('Numéro de téléphone').fill(credentials.phone);
    await page.getByRole('button', { name: 'Recevoir mon code' }).click();
    await expect(page.getByText(/^Code envoyé par e-mail à s•••@exemple\.tn\. Il est valable 5 minutes\./)).toBeVisible();
    await expect(page.getByText('Code envoyé par SMS')).toHaveCount(0);

    const devCode = (await page.getByText(/Votre code est \d{6}/).textContent())!.match(/\d{6}/)![0];
    await page.getByLabel('Code reçu', { exact: true }).fill(devCode);
    await page.getByRole('button', { name: 'Valider' }).click();
    await expect(page).toHaveURL(/\/espace$/);
  });

  test("lien d'activation du partenaire → numéro → code SMS → espace personnel", async ({ page, request }) => {
    const api = new Api(request);
    const admin = await api.admin();
    const partner = await api.createPartner(admin);
    const credentials = await api.createBeneficiary(admin, partner.id, 'Amira', `Sms${uid()}`);
    // the account must have reached the identity service
    await eventually(() => api.login('beneficiary', credentials.phone, credentials.temporaryPassword));

    await page.goto(`/connexion?p=${partner.id}`);
    await expect(page.getByText(`Bienvenue aux collaborateurs de ${partner.name}.`)).toBeVisible();
    await page.getByLabel('Numéro de téléphone').fill(`+216 ${credentials.phone.slice(0, 2)} ${credentials.phone.slice(2, 5)} ${credentials.phone.slice(5)}`);
    await page.getByRole('button', { name: 'Recevoir mon code' }).click();
    await expect(page.getByText(`Code envoyé par SMS au +216 •• ••• ${credentials.phone.slice(5)}`)).toBeVisible();

    const devCode = (await page.getByText(/Votre code est \d{6}/).textContent())!.match(/\d{6}/)![0];
    await expect(page.getByRole('button', { name: /Renvoyer un code \(\d+ s\)/ })).toBeDisabled();

    const code = page.getByLabel('Code reçu', { exact: true });
    await code.fill(devCode === '000000' ? '111111' : '000000');
    await page.getByRole('button', { name: 'Valider' }).click();
    await expect(alertIn(page).first()).toHaveText('Code incorrect. Il reste 2 essais.');

    await code.fill(devCode);
    await page.getByRole('button', { name: 'Valider' }).click();
    await expect(page).toHaveURL(/\/espace$/);
    await expect(page.getByText(`Amira ${credentials.lastName}`)).toBeVisible();

    // the account is counted as activated and its temporary password is retired
    await eventually(async () => {
      const b = await api.call<{ activatedAt: string | null }>('GET', `/api/beneficiaries/${credentials.beneficiaryId}`, admin);
      expect(b.activatedAt).not.toBeNull();
    });
    const old = await api.raw('POST', '/api/auth/login', undefined, {
      username: credentials.phone,
      password: credentials.temporaryPassword,
      space: 'BENEFICIARY',
    });
    expect(old.status()).toBe(401);
  });

  test('un numéro absent des listes est refusé', async ({ page }) => {
    await page.goto('/connexion');
    await page.getByLabel('Numéro de téléphone').fill(randomPhone());
    await page.getByRole('button', { name: 'Recevoir mon code' }).click();
    await expect(alertIn(page)).toHaveText(
      'Ce numéro ne figure sur aucune liste de bénéficiaires. Contactez le service RH de votre entreprise.',
    );
  });

  test("le numéro d'un autre partenaire est refusé sur ce lien : posséder le lien ne donne aucun accès", async ({ request }) => {
    const api = new Api(request);
    const admin = await api.admin();
    const mine = await api.createPartner(admin);
    const other = await api.createPartner(admin);
    const credentials = await api.createBeneficiary(admin, mine.id);
    await eventually(() => api.requestSms(credentials.phone, mine.id));

    const response = await api.raw('POST', '/api/auth/sms/request', undefined, { phone: credentials.phone, partnerId: other.id });
    expect(response.status()).toBe(403);
    expect((await response.json()).code).toBe('NUMBER_NOT_AUTHORIZED');
  });

  test('3 codes faux bloquent le code ; un code ne sert qu’une fois', async ({ request }) => {
    const api = new Api(request);
    const admin = await api.admin();
    const partner = await api.createPartner(admin);
    const credentials = await api.createBeneficiary(admin, partner.id);
    const sent = await eventually(() => api.requestSms(credentials.phone));
    expect(sent.expiresIn).toBe(300);
    const wrong = sent.devCode === '000000' ? '111111' : '000000';

    const codes: string[] = [];
    for (const code of [wrong, wrong, wrong, sent.devCode!]) {
      const response = await api.raw('POST', '/api/auth/sms/verify', undefined, { phone: credentials.phone, code });
      codes.push(`${response.status()} ${(await response.json()).code}`);
    }
    expect(codes).toEqual(['401 INVALID_SMS_CODE', '401 INVALID_SMS_CODE', '429 SMS_CODE_BLOCKED', '429 SMS_CODE_BLOCKED']);

    // resend immediately: refused (anti-abuse delay)
    const again = await api.raw('POST', '/api/auth/sms/request', undefined, { phone: credentials.phone });
    expect(again.status()).toBe(429);
    expect((await again.json()).code).toBe('SMS_RESEND_TOO_SOON');
  });

  test("un nouveau code sur un autre téléphone ferme la session du premier", async ({ request }) => {
    // waits for the resend delay (60 s) between the two phones
    test.setTimeout(150_000);
    const api = new Api(request);
    const admin = await api.admin();
    const partner = await api.createPartner(admin);
    const credentials = await api.createBeneficiary(admin, partner.id);
    const first = await api.smsLogin(credentials.phone);
    // the session stays open on this phone (long refresh token)
    const refreshed = await api.call<{ refreshToken: string }>('POST', '/api/auth/refresh', undefined, { refreshToken: first.refreshToken });

    // second phone, after the resend delay
    const second = await eventually(async () => api.verifySms(credentials.phone, (await api.requestSms(credentials.phone)).devCode!), 100_000);
    expect(second.accessToken).toBeTruthy();

    const stale = await api.raw('POST', '/api/auth/refresh', undefined, { refreshToken: refreshed.refreshToken });
    expect(stale.status()).toBe(401);
  });

  test("l'activation par SMS n'est possible que depuis l'application", async ({ request }) => {
    const response = await request.post(`${WEB_URL}/api/auth/sms/request`, { data: { phone: randomPhone() } });
    expect(response.status()).toBe(403);
    expect((await response.json()).code).toBe('MOBILE_APP_REQUIRED');
  });
});
