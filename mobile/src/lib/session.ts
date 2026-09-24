import type { AuthResult, Role, Space } from './types';
import { storage } from './storage';

export interface Session {
  space: Space;
  accessToken: string;
  refreshToken: string;
  accountId: string;
  role: Role;
  displayName: string;
  mustChangePassword: boolean;
}

const KEY = 'dp.session';
type Listener = (session: Session | null) => void;

let current: Session | null = null;
const listeners = new Set<Listener>();

/** A device holds one session at a time: a beneficiary's phone or a till tablet. */
export async function loadSession(): Promise<Session | null> {
  try {
    const raw = await storage.get(KEY);
    current = raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    current = null;
  }
  return current;
}

export function getSession(): Session | null {
  return current;
}

export async function saveSession(space: Space, auth: AuthResult): Promise<Session> {
  const session: Session = {
    space,
    accessToken: auth.accessToken,
    refreshToken: auth.refreshToken,
    accountId: auth.accountId,
    role: auth.role,
    displayName: auth.displayName,
    mustChangePassword: auth.mustChangePassword,
  };
  current = session;
  await storage.set(KEY, JSON.stringify(session));
  listeners.forEach((listener) => listener(session));
  return session;
}

export async function clearSession(): Promise<void> {
  current = null;
  await storage.remove(KEY);
  listeners.forEach((listener) => listener(null));
}

export function onSessionChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
