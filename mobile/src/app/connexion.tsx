import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { AuthHeader } from '@/components/AuthHeader';
import { Screen } from '@/components/Screen';
import { Alert, Button, Card, Field } from '@/components/ui';
import { api, errorMessage, login } from '@/lib/api';
import type { Space } from '@/lib/types';
import { homeOf } from '@/lib/useSession';

const LABELS: Record<Space, { title: string; subtitle: string; username: string; placeholder: string; secret: string }> = {
  beneficiary: {
    title: 'Espace bénéficiaire',
    subtitle: "Connectez-vous avec l'identifiant et le mot de passe remis par votre entreprise.",
    username: 'Identifiant (numéro de téléphone)',
    placeholder: '98 123 456',
    secret: 'Mot de passe',
  },
  staff: {
    title: 'Espace personnel',
    subtitle: 'Scanner des QR codes Damascino Privilèges en caisse.',
    username: 'Identifiant',
    placeholder: 'ex. caisse1',
    secret: 'Code PIN',
  },
};

export default function LoginScreen() {
  const params = useLocalSearchParams<{ espace?: string; expire?: string; p?: string }>();
  const space: Space = params.espace === 'staff' ? 'staff' : 'beneficiary';
  const labels = LABELS[space];
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [partner, setPartner] = useState<string | null>(null);

  // opened from a partner activation link: welcome its employees by name
  useEffect(() => {
    if (!params.p || !/^[0-9a-f-]{36}$/i.test(params.p)) return;
    api<{ name: string; active: boolean }>(`/api/partners/${params.p}/public`, { anonymous: true })
      .then((p) => p.active && setPartner(p.name))
      .catch(() => undefined);
  }, [params.p]);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      const session = await login(space, username, password);
      router.replace(homeOf(session));
    } catch (e) {
      setError(errorMessage(e));
      setLoading(false);
    }
  };

  return (
    <Screen header={<AuthHeader title={labels.title} subtitle={partner ? `Bienvenue aux collaborateurs de ${partner}.` : labels.subtitle} />}>
      <Card style={{ gap: 16 }}>
        {params.expire && !error && (
          <Alert tone="info">
            {params.expire === 'replaced'
              ? 'Votre compte s’est connecté sur un autre téléphone. Reconnectez-vous pour continuer ici.'
              : 'Votre session a expiré. Reconnectez-vous.'}
          </Alert>
        )}
        {error && <Alert>{error}</Alert>}
        <Field
          label={labels.username}
          placeholder={labels.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          keyboardType={space === 'beneficiary' ? 'phone-pad' : 'default'}
          value={username}
          onChangeText={setUsername}
          returnKeyType="next"
        />
        <Field
          label={labels.secret}
          secureTextEntry
          autoComplete="current-password"
          keyboardType={space === 'staff' ? 'number-pad' : 'default'}
          value={password}
          onChangeText={setPassword}
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        <Button title="Se connecter" large loading={loading} disabled={!username || !password} onPress={submit} />
      </Card>
    </Screen>
  );
}
