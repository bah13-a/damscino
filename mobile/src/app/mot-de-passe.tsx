import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { AuthHeader } from '@/components/AuthHeader';
import { Screen } from '@/components/Screen';
import { Alert, Button, Card, Field, T } from '@/components/ui';
import { api, errorMessage, logout } from '@/lib/api';
import { saveSession } from '@/lib/session';
import type { AuthResult } from '@/lib/types';
import { homeOf, useSession } from '@/lib/useSession';

export default function ChangePasswordScreen() {
  const session = useSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!session) return <Redirect href="/bienvenue" />;
  const pin = session.space === 'staff';
  const forced = session.mustChangePassword;

  const submit = async () => {
    setError(null);
    if (next !== confirm) {
      setError('Les deux saisies ne correspondent pas.');
      return;
    }
    setLoading(true);
    try {
      const auth = await api<AuthResult>('/api/auth/change-password', {
        method: 'POST',
        body: { currentPassword: current, newPassword: next },
      });
      const updated = await saveSession(session.space, auth);
      router.replace(homeOf(updated));
    } catch (e) {
      setError(errorMessage(e));
      setLoading(false);
    }
  };

  return (
    <Screen
      header={
        <AuthHeader
          back={!forced}
          title={forced ? 'Bienvenue !' : pin ? 'Changer mon code PIN' : 'Changer mon mot de passe'}
          subtitle={forced ? `${session.displayName}, pour sécuriser votre compte, choisissez votre propre ${pin ? 'code PIN' : 'mot de passe'}.` : undefined}
        />
      }
    >
      <Card style={{ gap: 16 }}>
        {error && <Alert>{error}</Alert>}
        <Field label={forced ? 'Mot de passe temporaire' : pin ? 'Code PIN actuel' : 'Mot de passe actuel'} secureTextEntry value={current} onChangeText={setCurrent} />
        <Field
          label={pin ? 'Nouveau code PIN' : 'Nouveau mot de passe'}
          secureTextEntry
          keyboardType={pin ? 'number-pad' : 'default'}
          autoComplete="new-password"
          hint={pin ? '4 à 8 chiffres' : '8 caractères minimum'}
          value={next}
          onChangeText={setNext}
        />
        <Field label="Confirmation" secureTextEntry keyboardType={pin ? 'number-pad' : 'default'} value={confirm} onChangeText={setConfirm} onSubmitEditing={submit} />
        <Button title="Enregistrer" large loading={loading} disabled={!current || !next || !confirm} onPress={submit} />
        <T
          variant="muted"
          style={{ textAlign: 'center', textDecorationLine: 'underline' }}
          accessibilityRole="button"
          onPress={async () => {
            await logout();
            router.replace('/bienvenue');
          }}
        >
          Se déconnecter
        </T>
      </Card>
    </Screen>
  );
}
