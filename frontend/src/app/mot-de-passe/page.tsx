'use client';

import { useRouter } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { AuthShell } from '@/components/AuthShell';
import { Alert, Button, Field } from '@/components/ui';
import { api, errorMessage, logout } from '@/lib/api';
import { HOME_PATH, LOGIN_PATH, saveSession, type Space } from '@/lib/session';
import type { AuthResult } from '@/lib/types';
import { useSession } from '@/lib/useSession';

function ChangePasswordForm({ space }: { space: Space }) {
  const router = useRouter();
  const session = useSession(space, { allowPasswordChange: true });
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const pin = space === 'staff';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError('Les deux saisies ne correspondent pas.');
      return;
    }
    setLoading(true);
    try {
      const auth = await api<AuthResult>(space, '/api/auth/change-password', {
        method: 'POST',
        body: { currentPassword: current, newPassword: next },
      });
      saveSession(space, auth);
      router.replace(HOME_PATH[space]);
    } catch (e) {
      setError(errorMessage(e));
      setLoading(false);
    }
  };

  if (!session) return null;
  return (
    <form onSubmit={submit} className="space-y-4">
      {session.mustChangePassword && (
        <Alert tone="info">
          Bienvenue {session.displayName} ! Pour sécuriser votre compte, choisissez votre propre {pin ? 'code PIN' : 'mot de passe'}.
        </Alert>
      )}
      {error && <Alert>{error}</Alert>}
      <Field
        label={session.mustChangePassword ? 'Mot de passe temporaire' : 'Mot de passe actuel'}
        type="password"
        autoComplete="current-password"
        required
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
      />
      <Field
        label={pin ? 'Nouveau code PIN' : 'Nouveau mot de passe'}
        type="password"
        autoComplete="new-password"
        hint={pin ? '4 à 8 chiffres' : '8 caractères minimum'}
        minLength={pin ? 4 : 8}
        required
        value={next}
        onChange={(e) => setNext(e.target.value)}
      />
      <Field
        label="Confirmation"
        type="password"
        autoComplete="new-password"
        required
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      <Button type="submit" size="lg" className="w-full" loading={loading}>
        Enregistrer
      </Button>
      <button
        type="button"
        className="w-full text-center text-sm text-muted underline"
        onClick={async () => {
          await logout(space);
          router.replace(LOGIN_PATH[space]);
        }}
      >
        Se déconnecter
      </button>
    </form>
  );
}

function Content() {
  // beneficiaries and staff change their password in the mobile app: on the web, only the administration
  const space: Space = 'admin';
  return (
    <AuthShell title="Changer le mot de passe">
      <ChangePasswordForm space={space} />
    </AuthShell>
  );
}

export default function ChangePasswordPage() {
  return (
    <Suspense>
      <Content />
    </Suspense>
  );
}
