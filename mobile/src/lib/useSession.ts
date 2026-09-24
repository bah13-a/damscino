import { useEffect, useState } from 'react';
import { getSession, onSessionChange, type Session } from './session';

export function useSession(): Session | null {
  const [session, setSession] = useState(getSession);
  useEffect(() => onSessionChange(setSession), []);
  return session;
}

/** Where a session lands once signed in. */
export function homeOf(session: Session | null): '/bienvenue' | '/mot-de-passe' | '/espace' | '/scanner' {
  if (!session) return '/bienvenue';
  if (session.mustChangePassword) return '/mot-de-passe';
  return session.space === 'beneficiary' ? '/espace' : '/scanner';
}
