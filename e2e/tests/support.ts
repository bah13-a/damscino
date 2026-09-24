import { expect, type APIRequestContext, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import fs from 'node:fs';

export type Space = 'beneficiary' | 'staff' | 'admin';
const ROLE: Record<Space, string> = { beneficiary: 'BENEFICIARY', staff: 'STAFF', admin: 'ADMIN' };

export const ADMIN = {
  username: process.env.E2E_ADMIN_USERNAME ?? 'admin',
  initialPassword: process.env.E2E_ADMIN_INITIAL_PASSWORD ?? 'Damascino2026!',
  password: process.env.E2E_ADMIN_PASSWORD ?? 'Admin-E2E-2026',
};

export interface Auth {
  accessToken: string;
  refreshToken: string;
  accountId: string;
  role: string;
  displayName: string;
  mustChangePassword: boolean;
}

export interface Credentials {
  beneficiaryId: string;
  firstName: string;
  lastName: string;
  phone: string;
  temporaryPassword: string;
}

export const uid = () => Math.random().toString(36).slice(2, 7);

/** Unique 8-digit phone number (prefix 9, based on time + randomness). */
export function randomPhone(): string {
  const n = (Date.now() % 1_000_000) * 10 + Math.floor(Math.random() * 10);
  return `9${String(n).padStart(7, '0').slice(-7)}`;
}

export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis' }).format(new Date());
export const shiftDays = (days: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis' }).format(new Date(Date.now() + days * 86_400_000));

/** Retries an assertion block until it passes (events are propagated asynchronously between services). */
export async function eventually<T>(fn: () => Promise<T>, timeout = 20_000): Promise<T> {
  const start = Date.now();
  let last: unknown;
  while (Date.now() - start < timeout) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw last;
}

/** Thin client of the REST API (through the frontend /api proxy). */
export class Api {
  constructor(private request: APIRequestContext) {}

  async raw(method: string, path: string, token?: string, body?: unknown) {
    return this.request.fetch(path, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      data: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  async call<T>(method: string, path: string, token?: string, body?: unknown): Promise<T> {
    const response = await this.raw(method, path, token, body);
    const text = await response.text();
    if (!response.ok()) throw new Error(`${method} ${path} → ${response.status()} ${text}`);
    return (text ? JSON.parse(text) : undefined) as T;
  }

  login(space: Space, username: string, password: string) {
    return this.call<Auth>('POST', '/api/auth/login', undefined, { username, password, space: ROLE[space] });
  }

  async admin(): Promise<string> {
    return (await this.login('admin', ADMIN.username, ADMIN.password)).accessToken;
  }

  createPartner(token: string, overrides: Record<string, unknown> = {}) {
    return this.call<{ id: string; name: string }>('POST', '/api/partners', token, {
      name: `E2E Partenaire ${uid()}`,
      contactName: 'Contact E2E',
      conventionStart: shiftDays(-30),
      conventionEnd: shiftDays(180),
      ...overrides,
    });
  }

  createBeneficiary(token: string, partnerId: string, firstName = 'Amira', lastName = `Test${uid()}`) {
    return this.call<Credentials>('POST', '/api/beneficiaries', token, { partnerId, firstName, lastName, phone: randomPhone() });
  }

  /** First login + mandatory password change; waits until the account reached the identity service. */
  async activate(credentials: Credentials, newPassword = 'Benef-E2E-2026'): Promise<Auth> {
    const first = await eventually(() => this.login('beneficiary', credentials.phone, credentials.temporaryPassword));
    return this.call<Auth>('POST', '/api/auth/change-password', first.accessToken, {
      currentPassword: credentials.temporaryPassword,
      newPassword,
    });
  }

  async createStaff(token: string, pin = '4321') {
    const username = `caisse${uid()}`;
    await this.call('POST', '/api/accounts', token, { role: 'STAFF', username, displayName: `Caissier ${username}`, secret: pin });
    return { username, pin, displayName: `Caissier ${username}` };
  }

  /** QR token of the day, once the beneficiary is known to the privilege service. */
  qr(beneficiaryToken: string) {
    return eventually(() => this.call<{ token: string; expiresAt: string; refreshInSeconds: number }>('POST', '/api/privileges/qr', beneficiaryToken));
  }

  verify(staffToken: string, token: string) {
    return this.call<{ status: string; reason: string | null }>('POST', '/api/privileges/scan/verify', staffToken, { token });
  }

  confirm(staffToken: string, token: string, dishPrice?: number) {
    return this.call<{ status: string; reason: string | null; discountAmount: number | null }>(
      'POST',
      '/api/privileges/scan/confirm',
      staffToken,
      { token, dishPrice: dishPrice ?? null },
    );
  }
}

/** Fills and submits the login form of a space. */
export async function uiLogin(page: Page, space: Space, username: string, password: string) {
  const path = { beneficiary: '/connexion', staff: '/personnel', admin: '/admin/connexion' }[space];
  await page.goto(path);
  await page.getByLabel(space === 'beneficiary' ? 'Identifiant (numéro de téléphone)' : 'Identifiant').fill(username);
  await page.getByLabel(space === 'staff' ? 'Code PIN' : 'Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

export async function adminLogin(page: Page) {
  await uiLogin(page, 'admin', ADMIN.username, ADMIN.password);
  await expect(page).toHaveURL(/\/admin$/);
}

/** Reads the first sheet of a downloaded .xlsx as an array of rows. */
export async function readXlsx(path: string): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  const rows: string[][] = [];
  workbook.worksheets[0].eachRow((row) => {
    rows.push((row.values as unknown[]).slice(1).map((v) => (v === null || v === undefined ? '' : String(v))));
  });
  return rows;
}

export function readText(path: string): string {
  return fs.readFileSync(path, 'utf8').replace(/^﻿/, '');
}

/** Visible alert of the page (excludes the empty Next.js route announcer, which also has role="alert"). */
export const alertIn = (scope: Page) => scope.locator('[role="alert"]:not(#__next-route-announcer__)');

/** Beneficiary ready to use the advantage: partner (optional rule overrides), activated account, fresh session. */
export async function readyBeneficiary(api: Api, partnerOverrides: Record<string, unknown> = {}) {
  const admin = await api.admin();
  const partner = await api.createPartner(admin, partnerOverrides);
  const credentials = await api.createBeneficiary(admin, partner.id, 'Karim', `Trabelsi${uid()}`);
  const password = 'Benef-E2E-2026';
  const auth = await api.activate(credentials, password);
  return { admin, partner, credentials, password, auth, fullName: `${credentials.firstName} ${credentials.lastName}` };
}

/** Opens the beneficiary space of {@code phone} in a page (UI login). */
export async function beneficiaryLogin(page: Page, phone: string, password: string) {
  await uiLogin(page, 'beneficiary', phone, password);
  await expect(page).toHaveURL(/\/espace$/);
}

/** Till registered in the administration, with its API key. */
export async function createTill(api: Api, adminToken: string) {
  const created = await api.call<{ terminal: { id: string; name: string }; apiKey: string }>('POST', '/api/pos-terminals', adminToken, {
    name: `Caisse E2E ${uid()}`,
  });
  return { ...created.terminal, apiKey: created.apiKey };
}

/** Calls the till API with an API key (the way a till software does). */
export async function tillCall<T = Record<string, any>>(request: APIRequestContext, apiKey: string, endpoint: string, body?: unknown) {
  const response = await request.fetch(`/api/pos/v1/${endpoint}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'X-Api-Key': apiKey, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    data: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status(), body: (await response.json().catch(() => ({}))) as T };
}

/** The ticket of the specification: Eau 4 DT + Azmari Kebab 40 DT + Kunafa 15 DT. */
export const specTicket = (code: string, ticketId: string) => ({
  code,
  ticketId,
  cashier: 'Sami',
  lines: [
    { lineId: '1', sku: 'EAU-50', label: 'Eau', category: 'BOISSONS', unitPrice: 4, quantity: 1 },
    { lineId: '2', sku: 'KEB-AZM', label: 'Azmari Kebab', category: 'PLATS', unitPrice: 40, quantity: 1 },
    { lineId: '3', sku: 'DES-KUN', label: 'Kunafa', category: 'DESSERTS', unitPrice: 15, quantity: 1 },
  ],
});
