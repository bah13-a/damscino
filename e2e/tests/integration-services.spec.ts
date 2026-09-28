import { execSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { Api, eventually, randomPhone, readyBeneficiary, uid, type Auth } from './support';

/**
 * Integration tests through the gateway: the microservices only share data through events (RabbitMQ + outbox),
 * so every business action is checked in the services that consume it, with the propagation time.
 */

interface Totals {
  authorized: number;
  activated: number;
  activeUsers: number;
  redemptions: number;
  refusals: number;
  dishTotal: number;
  discountTotal: number;
}

/** Waits for a propagated state and records how long it took (shown in the report). */
async function propagated<T>(label: string, fn: () => Promise<T>, timeout = 20_000): Promise<T> {
  const start = Date.now();
  const result = await eventually(fn, timeout);
  test.info().annotations.push({ type: 'propagation', description: `${label}: ${Date.now() - start} ms` });
  return result;
}

test.describe('Intégration · événements entre microservices', () => {
  test('un bénéficiaire créé est propagé à identity, privilege et reporting, puis son activation revient au partenaire', async ({ request }) => {
    const api = new Api(request);
    const admin = await api.admin();
    const partner = await api.createPartner(admin);
    const stats = async () => (await api.call<{ totals: Totals }>('GET', `/api/reporting/statistics?partnerId=${partner.id}`, admin)).totals;
    expect((await stats()).authorized).toBe(0);

    const credentials = await api.createBeneficiary(admin, partner.id, 'Inès', `Integration${uid()}`);
    // partner-service → identity-service : the account exists
    const first = await propagated('partner → identity (compte créé)', () => api.login('beneficiary', credentials.phone, credentials.temporaryPassword));
    expect(first.mustChangePassword).toBe(true);
    // partner-service → reporting-service : one more authorised person
    await propagated('partner → reporting (autorisés)', async () => expect((await stats()).authorized).toBe(1));

    const auth = await api.activate(credentials);
    // identity-service → partner-service : the account is shown as activated
    await propagated('identity → partner (compte activé)', async () => {
      const b = await api.call<{ accountActivated: boolean }>('GET', `/api/beneficiaries/${credentials.beneficiaryId}`, admin);
      expect(b.accountActivated).toBe(true);
    });
    await propagated('identity → reporting (activés)', async () => expect((await stats()).activated).toBe(1));
    // partner-service → privilege-service : the advantage is known and a QR code can be issued
    const qr = await propagated('partner → privilege (QR disponible)', () => api.qr(auth.accessToken));
    expect(qr.token).toMatch(/^DP1\./);
  });

  test('un passage validé est projeté dans le reporting (montants, personnel, statistiques)', async ({ request }) => {
    const api = new Api(request);
    const b = await readyBeneficiary(api);
    const staff = await api.createStaff(b.admin);
    const staffToken = (await api.login('staff', staff.username, staff.pin)).accessToken;
    const { token } = await api.qr(b.auth.accessToken);
    const confirmed = await api.confirm(staffToken, token, 40);
    expect(confirmed).toMatchObject({ status: 'CONFIRMED', discountAmount: 8 });

    const usage = await propagated('privilege → reporting (passage)', async () => {
      const page = await api.call<{ items: Array<Record<string, unknown>> }>('GET', `/api/reporting/usages?partnerId=${b.partner.id}`, b.admin);
      expect(page.items).toHaveLength(1);
      return page.items[0];
    });
    expect(usage).toMatchObject({ beneficiaryName: b.fullName, partnerName: b.partner.name, staffName: staff.displayName, dishPrice: 40, discountAmount: 8 });

    const totals = await propagated('privilege → reporting (statistiques)', async () => {
      const t = (await api.call<{ totals: Totals }>('GET', `/api/reporting/statistics?partnerId=${b.partner.id}`, b.admin)).totals;
      expect(t.redemptions).toBe(1);
      // activation (identity) and passage (privilege) come from two independent outboxes
      expect(t.activated).toBe(1);
      return t;
    });
    expect(totals).toMatchObject({ authorized: 1, activated: 1, activeUsers: 1, redemptions: 1, dishTotal: 40, discountTotal: 8 });

    // the beneficiary's own view (privilege-service) agrees
    const me = await api.call<{ availability: string; history: Array<{ discountAmount: number }> }>('GET', '/api/privileges/me', b.auth.accessToken);
    expect(me.availability).toBe('USED');
    expect(me.history[0].discountAmount).toBe(8);
  });

  test('un refus est projeté dans le journal des refus avec son motif', async ({ request }) => {
    const api = new Api(request);
    const b = await readyBeneficiary(api);
    const staff = await api.createStaff(b.admin);
    const staffToken = (await api.login('staff', staff.username, staff.pin)).accessToken;
    const { token } = await api.qr(b.auth.accessToken);
    await api.call('PATCH', `/api/beneficiaries/${b.credentials.beneficiaryId}/status`, b.admin, { active: false });
    await propagated('partner → privilege (désactivation)', async () => expect((await api.verify(staffToken, token)).reason).toBe('BENEFICIARY_INACTIVE'));

    const row = await propagated('privilege → reporting (refus)', async () => {
      const page = await api.call<{ items: Array<Record<string, unknown>> }>('GET', `/api/reporting/rejections?partnerId=${b.partner.id}`, b.admin);
      expect(page.items.length).toBeGreaterThan(0);
      return page.items[0];
    });
    expect(row).toMatchObject({ beneficiaryName: b.fullName, reason: 'BENEFICIARY_INACTIVE', staffName: staff.displayName });
  });

  test('règle modifiée, partenaire désactivé puis réactivé : propagés au service privilèges', async ({ request }) => {
    const api = new Api(request);
    const b = await readyBeneficiary(api);
    const staffToken = (await api.login('staff', ...Object.values(await api.createStaff(b.admin)).slice(0, 2) as [string, string])).accessToken;
    await api.qr(b.auth.accessToken);

    await api.call('PUT', `/api/partners/${b.partner.id}/rule`, b.admin, {
      discountPercent: 15, eligibleCategories: ['PLATS'], excludedCategories: ['BOISSONS'], usagesPerPeriod: 1, usagePeriod: 'DAY',
    });
    await propagated('partner → privilege (règle)', async () => {
      const result = await api.call<{ discountPercent: number }>('POST', '/api/privileges/scan/verify', staffToken, { token: (await api.qr(b.auth.accessToken)).token });
      expect(result.discountPercent).toBe(15);
    });

    await api.call('PATCH', `/api/partners/${b.partner.id}/status`, b.admin, { active: false });
    await propagated('partner → privilege (partenaire inactif)', async () => {
      const response = await api.raw('POST', '/api/privileges/qr', b.auth.accessToken);
      expect((await response.json()).code).toBe('PARTNER_INACTIVE');
    });
    await api.call('PATCH', `/api/partners/${b.partner.id}/status`, b.admin, { active: true });
    await propagated('partner → privilege (réactivation)', () => api.qr(b.auth.accessToken));
  });

  test("changement de téléphone : le nouvel identifiant fonctionne, l'ancien non", async ({ request }) => {
    const api = new Api(request);
    const b = await readyBeneficiary(api);
    const newPhone = randomPhone();
    await api.call('PUT', `/api/beneficiaries/${b.credentials.beneficiaryId}`, b.admin, {
      partnerId: b.partner.id, firstName: b.credentials.firstName, lastName: b.credentials.lastName, phone: newPhone,
    });
    await propagated('partner → identity (identifiant)', () => api.login('beneficiary', newPhone, b.password));
    const old = await api.raw('POST', '/api/auth/login', undefined, { username: b.credentials.phone, password: b.password, space: 'BENEFICIARY' });
    expect(old.status()).toBe(401);
  });

  test("les actions d'administration sont tracées dans le journal", async ({ request }) => {
    const api = new Api(request);
    const admin = await api.admin();
    const partner = await api.createPartner(admin);
    await propagated('partner → reporting (journal)', async () => {
      const page = await api.call<{ items: Array<{ action: string; actorName: string }> }>('GET', `/api/reporting/audit?text=${encodeURIComponent(partner.name)}`, admin);
      expect(page.items.length).toBeGreaterThan(0);
    });
  });

  test('le rejeu des événements (republish) ne double aucun chiffre', async ({ request }) => {
    const api = new Api(request);
    const b = await readyBeneficiary(api);
    const stats = async () => (await api.call<{ totals: Totals }>('GET', `/api/reporting/statistics?partnerId=${b.partner.id}`, b.admin)).totals;
    await eventually(async () => expect((await stats()).activated).toBe(1));
    const before = await stats();
    const replay = await api.call<{ events: number }>('POST', '/api/partners/republish', b.admin);
    expect(replay.events).toBeGreaterThan(0);
    await new Promise((resolve) => setTimeout(resolve, 4000));
    expect(await stats()).toEqual(before);
  });
});

test.describe('Intégration · gateway, sécurité et sessions', () => {
  test('matrice des droits par rôle à travers la gateway', async ({ request }) => {
    const api = new Api(request);
    const b = await readyBeneficiary(api);
    const staff = await api.createStaff(b.admin);
    const staffToken = (await api.login('staff', staff.username, staff.pin)).accessToken;
    const tokens: Record<string, string | undefined> = { anonyme: undefined, bénéficiaire: b.auth.accessToken, personnel: staffToken, admin: b.admin };
    // expected HTTP status for each role (anonymous, beneficiary, staff, admin)
    const matrix: Array<[string, string, number[]]> = [
      ['GET', '/api/partners', [401, 403, 403, 200]],
      ['GET', '/api/beneficiaries', [401, 403, 403, 200]],
      ['GET', '/api/accounts', [401, 403, 403, 200]],
      ['GET', '/api/reporting/statistics', [401, 403, 403, 200]],
      ['GET', '/api/reporting/audit', [401, 403, 403, 200]],
      ['GET', '/api/pos-terminals', [401, 403, 403, 200]],
      ['GET', '/api/privileges/me', [401, 200, 403, 403]],
      ['GET', '/api/privileges/settings', [401, 403, 200, 200]],
      ['GET', '/api/auth/me', [401, 200, 200, 200]],
    ];
    const failures: string[] = [];
    for (const [method, path, expected] of matrix) {
      const roles = Object.keys(tokens);
      for (let i = 0; i < roles.length; i++) {
        const status = (await api.raw(method, path, tokens[roles[i]])).status();
        if (status !== expected[i]) failures.push(`${method} ${path} en ${roles[i]} : ${status} au lieu de ${expected[i]}`);
      }
    }
    expect(failures).toEqual([]);
  });

  test('jetons : rotation du jeton de rafraîchissement, réutilisation et déconnexion refusées', async ({ request }) => {
    const api = new Api(request);
    const staff = await api.createStaff(await api.admin());
    const auth = await api.login('staff', staff.username, staff.pin);
    const rotated = await api.call<Auth>('POST', '/api/auth/refresh', undefined, { refreshToken: auth.refreshToken });
    expect(rotated.refreshToken).not.toBe(auth.refreshToken);
    expect((await api.raw('GET', '/api/auth/me', rotated.accessToken)).status()).toBe(200);
    // the old refresh token can no longer be used
    expect((await api.raw('POST', '/api/auth/refresh', undefined, { refreshToken: auth.refreshToken })).status()).toBe(401);
    // after logout, the current one neither
    await api.call('POST', '/api/auth/logout', undefined, { refreshToken: rotated.refreshToken });
    expect((await api.raw('POST', '/api/auth/refresh', undefined, { refreshToken: rotated.refreshToken })).status()).toBe(401);
    // a forged access token is refused by every service
    for (const path of ['/api/auth/me', '/api/partners', '/api/privileges/me', '/api/reporting/statistics']) {
      expect((await api.raw('GET', path, `${rotated.accessToken.slice(0, -4)}abcd`)).status(), path).toBe(401);
    }
  });

  test("session unique : le jeton de l'ancien téléphone est refusé par le service privilèges", async ({ request }) => {
    const api = new Api(request);
    const b = await readyBeneficiary(api);
    await api.qr(b.auth.accessToken);
    await api.login('beneficiary', b.credentials.phone, b.password); // second phone
    await propagated('identity → privilege (session remplacée)', async () => {
      const response = await api.raw('GET', '/api/privileges/me', b.auth.accessToken);
      expect(response.status()).toBe(401);
      expect((await response.json()).code).toBe('SESSION_REPLACED');
    });
  });

  test("modifications simultanées d'un même bénéficiaire : aucune erreur serveur, état final cohérent", async ({ request }) => {
    const api = new Api(request);
    const b = await readyBeneficiary(api);
    const names = Array.from({ length: 10 }, (_, i) => `Concurrent${i}${uid()}`);
    const responses = await Promise.all(names.map((lastName) =>
      api.raw('PUT', `/api/beneficiaries/${b.credentials.beneficiaryId}`, b.admin, {
        partnerId: b.partner.id, firstName: b.credentials.firstName, lastName, phone: b.credentials.phone,
      })));
    const statuses = responses.map((r) => r.status());
    expect(statuses.filter((s) => s >= 500)).toEqual([]);
    expect(statuses.filter((s) => s === 200).length).toBeGreaterThan(0);
    const final = await api.call<{ lastName: string }>('GET', `/api/beneficiaries/${b.credentials.beneficiaryId}`, b.admin);
    expect(names).toContain(final.lastName);
    // the identity account follows the last saved name
    await propagated('partner → identity (nom)', async () => {
      const me = await api.call<{ displayName: string }>('GET', '/api/auth/me', (await api.login('beneficiary', b.credentials.phone, b.password)).accessToken);
      expect(me.displayName).toContain(final.lastName);
    });
  });
});

/**
 * Broker outage: the transactional outbox must keep the events and deliver them once RabbitMQ is back.
 * Needs control of the broker: E2E_BROKER_STOP / E2E_BROKER_START (shell commands), e.g. on a local stack
 * E2E_BROKER_STOP="rabbitmqctl stop_app" E2E_BROKER_START="rabbitmqctl start_app".
 */
test.describe('Intégration · résilience', () => {
  test.skip(!process.env.E2E_BROKER_STOP || !process.env.E2E_BROKER_START, 'contrôle de RabbitMQ non configuré');

  test("RabbitMQ arrêté : les actions réussissent et les événements sont livrés à son retour (outbox)", async ({ request }) => {
    test.setTimeout(180_000);
    const api = new Api(request);
    const admin = await api.admin();
    const partner = await api.createPartner(admin);
    await eventually(async () => {
      const r = await api.raw('GET', `/api/reporting/statistics?partnerId=${partner.id}`, admin);
      expect(r.status()).toBe(200);
    });

    execSync(process.env.E2E_BROKER_STOP!, { stdio: 'ignore' });
    let credentials;
    try {
      // the write succeeds while the broker is down: the event waits in the outbox
      credentials = await api.createBeneficiary(admin, partner.id, 'Panne', `Broker${uid()}`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const early = await api.raw('POST', '/api/auth/login', undefined, { username: credentials.phone, password: credentials.temporaryPassword, space: 'BENEFICIARY' });
      expect(early.status(), 'pas encore propagé pendant la panne').toBe(401);
    } finally {
      execSync(process.env.E2E_BROKER_START!, { stdio: 'ignore' });
    }
    await propagated('outbox → identity après retour du broker', () => api.login('beneficiary', credentials!.phone, credentials!.temporaryPassword), 90_000);
  });
});
