import type { AuthResult, Role } from './types';

/** The three spaces of the PWA each keep their own session, so one device can host several roles. */
export type Space = 'beneficiary' | 'staff' | 'admin';

export const SPACE_ROLE: Record<Space, Role> = { beneficiary: 'BENEFICIARY', staff: 'STAFF', admin: 'ADMIN' };
export const LOGIN_PATH: Record<Space, string> = {
  beneficiary: '/connexion',
  staff: '/personnel',
  admin: '/admin/connexion',
};
export const HOME_PATH: Record<Space, string> = {
  beneficiary: '/espace',
  staff: '/personnel/scanner',
  admin: '/admin',
};

export interface Session {
  accessToken: string;
  refreshToken: string;
  accountId: string;
  role: Role;
  displayName: string;
  mustChangePassword: boolean;
}

const key = (space: Space) => `dp.session.${space}`;

export function getSession(space: Space): Session | null {
  try {
    const raw = window.localStorage.getItem(key(space));
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(space: Space, auth: AuthResult): Session {
  const session: Session = {
    accessToken: auth.accessToken,
    refreshToken: auth.refreshToken,
    accountId: auth.accountId,
    role: auth.role,
    displayName: auth.displayName,
    mustChangePassword: auth.mustChangePassword,
  };
  try {
    window.localStorage.setItem(key(space), JSON.stringify(session));
  } catch {
    // private mode: the session lives only in memory for this page
  }
  return session;
}

export function clearSession(space: Space) {
  try {
    window.localStorage.removeItem(key(space));
  } catch {
    // ignore
  }
}

export function isSpace(value: string | null): value is Space {
  return value === 'beneficiary' || value === 'staff' || value === 'admin';
}
