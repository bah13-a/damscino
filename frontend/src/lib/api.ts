import type { AuthResult } from './types';
import { clearSession, getSession, saveSession, SPACE_ROLE, type Space } from './session';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

type Body = FormData | object | undefined;

interface Options {
  method?: string;
  body?: Body;
  signal?: AbortSignal;
}

const refreshing = new Map<Space, Promise<boolean>>();

async function parseError(response: Response): Promise<ApiError> {
  try {
    const data = await response.json();
    return new ApiError(response.status, data.code ?? 'ERROR', data.message ?? 'Erreur', data.fields ?? {});
  } catch {
    // 500 without JSON body = the Next.js proxy could not reach the API gateway (starting or stopped)
    if (response.status >= 500) {
      return new ApiError(response.status, 'UNAVAILABLE', 'Service en cours de démarrage, réessayez dans un instant.');
    }
    return new ApiError(response.status, 'ERROR', `Erreur ${response.status}`);
  }
}

/** Rotates the refresh token once for all concurrent requests of the same space. */
function refresh(space: Space): Promise<boolean> {
  const pending = refreshing.get(space);
  if (pending) return pending;
  const attempt = (async () => {
    const session = getSession(space);
    if (!session?.refreshToken) return false;
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
    if (!response.ok) return false;
    saveSession(space, (await response.json()) as AuthResult);
    return true;
  })().finally(() => refreshing.delete(space));
  refreshing.set(space, attempt);
  return attempt;
}

function expire(space: Space) {
  clearSession(space);
  window.dispatchEvent(new CustomEvent('dp:session-expired', { detail: { space } }));
}

async function send(space: Space | null, path: string, options: Options, retry: boolean): Promise<Response> {
  const headers: Record<string, string> = {};
  const session = space ? getSession(space) : null;
  if (session) headers.Authorization = `Bearer ${session.accessToken}`;
  let body: BodyInit | undefined;
  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  const response = await fetch(path, { method: options.method ?? 'GET', headers, body, signal: options.signal });
  if (response.status === 401 && space && session && retry) {
    const error = await parseError(response.clone());
    if (error.code === 'SESSION_REPLACED') {
      expire(space);
      throw error;
    }
    if (await refresh(space)) return send(space, path, options, false);
    expire(space);
  }
  return response;
}

export async function api<T>(space: Space | null, path: string, options: Options = {}): Promise<T> {
  const response = await send(space, path, options, true);
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  const type = response.headers.get('content-type') ?? '';
  return (type.includes('json') ? await response.json() : undefined) as T;
}

/** Downloads an Excel / CSV export with the bearer token. */
export async function download(space: Space, path: string, fallbackName: string) {
  const response = await send(space, path, {}, true);
  if (!response.ok) throw await parseError(response);
  const disposition = response.headers.get('content-disposition') ?? '';
  const match = /filename\*=UTF-8''([^;]+)/i.exec(disposition) ?? /filename="?([^";]+)"?/i.exec(disposition);
  const name = match ? decodeURIComponent(match[1]) : fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function login(space: Space, username: string, password: string) {
  const auth = await api<AuthResult>(null, '/api/auth/login', {
    method: 'POST',
    body: { username, password, space: SPACE_ROLE[space] },
  });
  return saveSession(space, auth);
}

export async function logout(space: Space) {
  const session = getSession(space);
  clearSession(space);
  if (session) {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    }).catch(() => undefined);
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) return 'Connexion impossible. Vérifiez votre réseau.';
  return 'Une erreur est survenue.';
}
