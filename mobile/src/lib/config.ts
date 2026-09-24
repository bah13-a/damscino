import { storage } from './storage';

const SERVER_KEY = 'dp.server';
const BUILT_IN = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

/** Environment of the build: "test" (Codespace, demos) or "prod". */
export const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV === 'prod' ? 'prod' : 'test';

/** Test builds may point the app to another server (a Codespace, a demo); production builds never. */
export const SERVER_CHANGE_ALLOWED = process.env.EXPO_PUBLIC_ALLOW_SERVER_CHANGE === '1' || !BUILT_IN;

let current = BUILT_IN;

export async function loadServer(): Promise<string> {
  if (SERVER_CHANGE_ALLOWED) {
    const saved = await storage.get(SERVER_KEY);
    if (saved) current = saved;
  }
  return current;
}

export function server(): string {
  return current;
}

/** Plain HTTP is blocked by Android and iOS: the address must be HTTPS (Codespaces, Caddy…). */
export function checkServerAddress(url: string): string | null {
  if (!/^https?:\/\/[^/\s]+/i.test(url)) return 'Adresse invalide. Exemple : https://mon-codespace-3000.app.github.dev';
  if (/^http:\/\//i.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:|$)/i.test(url)) {
    return 'L’adresse doit commencer par https:// (les téléphones bloquent http://).';
  }
  return null;
}

/** Keeps only the site address, even if a page link was pasted (…/admin/connexion). */
export function normalizeServer(value: string): string {
  let url = value.trim();
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
  const match = /^(https?:\/\/[^/?#\s]+)/i.exec(url);
  return match ? match[1].toLowerCase() : url.replace(/\/+$/, '');
}

export async function saveServer(value: string): Promise<void> {
  current = normalizeServer(value);
  await storage.set(SERVER_KEY, current);
}
