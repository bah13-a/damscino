'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getSession, LOGIN_PATH, type Session, type Space } from './session';

/**
 * Guards a page of a space: redirects to the login page without session, and to the password change page while
 * the temporary password has not been replaced.
 */
export function useSession(space: Space, { allowPasswordChange = false } = {}): Session | null {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const current = getSession(space);
    if (!current) {
      router.replace(LOGIN_PATH[space]);
      return;
    }
    if (current.mustChangePassword && !allowPasswordChange) {
      router.replace(`/mot-de-passe?espace=${space}`);
      return;
    }
    setSession(current);

    const onExpired = (event: Event) => {
      if ((event as CustomEvent).detail?.space === space) router.replace(`${LOGIN_PATH[space]}?expire=1`);
    };
    window.addEventListener('dp:session-expired', onExpired);
    return () => window.removeEventListener('dp:session-expired', onExpired);
  }, [space, router, allowPasswordChange]);

  return session;
}
