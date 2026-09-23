'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { errorMessage, login } from '@/lib/api';
import { getSession, HOME_PATH, type Space } from '@/lib/session';
import { Alert, Button, Field } from './ui';

const LABELS: Record<Space, { username: string; placeholder: string; secret: string; inputMode?: 'numeric' | 'tel' }> = {
  beneficiary: { username: 'Identifiant (numéro de téléphone)', placeholder: '98 123 456', secret: 'Mot de passe', inputMode: 'tel' },
  staff: { username: 'Identifiant', placeholder: 'ex. caisse1', secret: 'Code PIN', inputMode: 'numeric' },
  admin: { username: 'Identifiant', placeholder: 'admin', secret: 'Mot de passe' },
};

export function LoginForm({ space }: { space: Space }) {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const labels = LABELS[space];

  useEffect(() => {
    const session = getSession(space);
    if (session && !session.mustChangePassword) router.replace(HOME_PATH[space]);
  }, [space, router]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const session = await login(space, username, password);
      router.replace(session.mustChangePassword ? `/mot-de-passe?espace=${space}` : HOME_PATH[space]);
    } catch (e) {
      setError(errorMessage(e));
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {params.get('expire') && !error && (
        <Alert tone="info">Votre session a expiré ou votre compte s&apos;est connecté sur un autre appareil.</Alert>
      )}
      {error && <Alert>{error}</Alert>}
      <Field
        label={labels.username}
        placeholder={labels.placeholder}
        autoComplete="username"
        inputMode={space === 'beneficiary' ? 'tel' : undefined}
        autoCapitalize="none"
        required
        value={username}
        onChange={(event) => setUsername(event.target.value)}
      />
      <Field
        label={labels.secret}
        type="password"
        autoComplete="current-password"
        inputMode={labels.inputMode === 'numeric' ? 'numeric' : undefined}
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <Button type="submit" size="lg" className="w-full" loading={loading}>
        Se connecter
      </Button>
    </form>
  );
}
