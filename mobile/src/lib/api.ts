import Constants from 'expo-constants';
import { server } from './config';

const BAD_SERVER_MESSAGE =
  "Le serveur ne répond pas comme prévu : vérifiez son adresse (Serveur · Modifier). Avec un Codespace, le port 3000 doit être en visibilité Public.";
import { clearSession, getSession, saveSession } from './session';
import { SPACE_ROLE, type AuthResult, type Space } from './types';

/** Sent with every call: the API only lets beneficiaries and staff sign in from the app. */
export const CLIENT_HEADER = { 'X-Client-App': `damascino-mobile/${Constants.expoConfig?.version ?? '1'}` };

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields: Record<string, string> = {},
  ) {
    super(message);
    // a transpiled subclass of Error loses its prototype on some engines: `instanceof ApiError` would then be false
    // and the server's message replaced by a generic one
    Object.setPrototypeOf(this, ApiError.prototype);
    this.name = 'ApiError';
  }
}

function isApiError(error: unknown): error is ApiError {
  if (error instanceof ApiError) return true;
  const e = error as Partial<ApiError> | null;
  return !!e && typeof e === 'object' && typeof e.code === 'string' && typeof e.status === 'number' && typeof e.message === 'string';
}

/** Why the session ended, shown on the login screen. */
export type ExpiryReason = 'expired' | 'replaced';
let expiryHandler: ((reason: ExpiryReason) => void) | null = null;
export function onSessionExpired(handler: (reason: ExpiryReason) => void) {
  expiryHandler = handler;
}

/** An HTML page instead of the API: wrong address, or a private Codespace port answering with GitHub's login page. */
function isHtml(response: Response) {
  return (response.headers.get('content-type') ?? '').includes('text/html');
}

async function parseError(response: Response): Promise<ApiError> {
  if (isHtml(response)) return new ApiError(response.status, 'BAD_SERVER', BAD_SERVER_MESSAGE);
  try {
    const data = await response.json();
    return new ApiError(response.status, data.code ?? 'ERROR', data.message ?? 'Erreur', data.fields ?? {});
  } catch {
    if (response.status >= 500) {
      return new ApiError(response.status, 'UNAVAILABLE', 'Service en cours de démarrage, réessayez dans un instant.');
    }
    return new ApiError(response.status, 'ERROR', `Erreur ${response.status}`);
  }
}

function url(path: string) {
  if (!server()) throw new ApiError(0, 'NO_SERVER', 'Adresse du serveur non configurée : touchez « Serveur · Modifier ».');
  return `${server()}${path}`;
}

let refreshing: Promise<boolean> | null = null;

/** Rotates the refresh token once for all concurrent requests. */
function refresh(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const session = getSession();
    if (!session?.refreshToken) return false;
    const response = await fetch(url('/api/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...CLIENT_HEADER },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
    if (!response.ok) return false;
    await saveSession(session.space, (await response.json()) as AuthResult);
    return true;
  })()
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function expire(reason: ExpiryReason) {
  await clearSession();
  expiryHandler?.(reason);
}

async function send(path: string, method: string, body: unknown, authenticated: boolean, retry: boolean): Promise<Response> {
  const session = authenticated ? getSession() : null;
  const headers: Record<string, string> = { ...CLIENT_HEADER };
  if (session) headers.Authorization = `Bearer ${session.accessToken}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(url(path), { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (response.status === 401 && session && retry) {
    const error = await parseError(response.clone());
    if (error.code === 'SESSION_REPLACED') {
      await expire('replaced');
      throw error;
    }
    if (await refresh()) return send(path, method, body, authenticated, false);
    await expire('expired');
  }
  return response;
}

export async function api<T>(path: string, options: { method?: string; body?: unknown; anonymous?: boolean } = {}): Promise<T> {
  const response = await send(path, options.method ?? 'GET', options.body, !options.anonymous, true);
  if (!response.ok || isHtml(response)) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  const type = response.headers.get('content-type') ?? '';
  return (type.includes('json') ? await response.json() : undefined) as T;
}

export async function login(space: Space, username: string, password: string) {
  const auth = await api<AuthResult>('/api/auth/login', {
    method: 'POST',
    anonymous: true,
    body: { username: username.trim(), password, space: SPACE_ROLE[space] },
  });
  return saveSession(space, auth);
}

export interface SmsCodeSent {
  maskedPhone: string;
  expiresIn: number;
  resendIn: number;
  /** Test environment only: nothing is sent, the code is returned to the app. */
  devCode: string | null;
  /** true when the code left by SMS (no e-mail on the partner list, or the e-mail failed) */
  smsSent?: boolean;
  /** address the code was sent to (masked), null when it left by SMS */
  maskedEmail?: string | null;
}

/** Beneficiary activation, step 1: the number must be on the list of a partner (of `partnerId` when given). */
export function requestSmsCode(phone: string, partnerId?: string) {
  return api<SmsCodeSent>('/api/auth/sms/request', {
    method: 'POST',
    anonymous: true,
    body: { phone: phone.trim(), partnerId: partnerId || null },
  });
}

/** Step 2: a valid code activates the account and keeps this phone signed in. */
export async function verifySmsCode(phone: string, code: string) {
  const auth = await api<AuthResult>('/api/auth/sms/verify', {
    method: 'POST',
    anonymous: true,
    body: { phone: phone.trim(), code: code.trim() },
  });
  return saveSession('beneficiary', auth);
}

export async function logout() {
  const session = getSession();
  await clearSession();
  if (session) {
    await fetch(url('/api/auth/logout'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...CLIENT_HEADER },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    }).catch(() => undefined);
  }
}

export function errorMessage(error: unknown): string {
  if (isApiError(error)) return error.message;
  // fetch rejects with a TypeError ("Network request failed") when the server cannot be reached
  if (error instanceof TypeError || (error instanceof Error && /network request failed|failed to fetch/i.test(error.message))) {
    return `Connexion impossible au serveur ${server() || '(adresse non configurée)'}. Vérifiez votre connexion internet et l'adresse du serveur (avec un Codespace : démarré, port 3000 en Public).`;
  }
  return error instanceof Error && error.message ? `Une erreur est survenue : ${error.message}` : 'Une erreur est survenue.';
}
