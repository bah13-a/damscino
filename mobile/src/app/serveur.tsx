import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { AuthHeader } from '@/components/AuthHeader';
import { Screen } from '@/components/Screen';
import { Alert, Button, Card, Field } from '@/components/ui';
import { CLIENT_HEADER } from '@/lib/api';
import { checkServerAddress, normalizeServer, saveServer, server } from '@/lib/config';

/** Test builds only: point the app to the address of a test server (Codespace, demo…). */
export default function ServerScreen() {
  const params = useLocalSearchParams<{ espace?: string }>();
  const [value, setValue] = useState(server());
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const save = async () => {
    setError(null);
    const url = normalizeServer(value);
    const invalid = checkServerAddress(url);
    if (invalid) {
      setError(invalid);
      return;
    }
    setChecking(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      // the API answers 401 in JSON on /api/auth/me without a session: proof it is a Damascino server
      const response = await fetch(`${url}/api/auth/me`, { headers: CLIENT_HEADER, signal: controller.signal });
      const type = response.headers.get('content-type') ?? '';
      if (type.includes('text/html')) {
        setError('Cette adresse renvoie une page web, pas l’API Damascino. Avec un Codespace : onglet PORTS → port 3000 → Port Visibility → Public.');
      } else if (response.status === 401 && type.includes('json')) {
        await saveServer(url);
        if (params.espace) router.replace({ pathname: '/connexion', params: { espace: params.espace } });
        else router.replace('/bienvenue');
        return;
      } else if (response.status >= 500) {
        setError('Le serveur démarre ou est arrêté. Réessayez dans une minute (docker compose up -d).');
      } else {
        setError(`Réponse inattendue du serveur (${response.status}). Vérifiez l’adresse.`);
      }
    } catch {
      setError('Serveur injoignable à cette adresse. Vérifiez l’adresse, votre connexion internet et que le Codespace est démarré.');
    } finally {
      clearTimeout(timeout);
    }
    setChecking(false);
  };

  return (
    <Screen header={<AuthHeader title="Serveur" subtitle="Adresse du site Damascino Privilèges (version de test)." />}>
      <Card style={{ gap: 16 }}>
        {error && <Alert>{error}</Alert>}
        <Field
          label="Adresse du serveur"
          placeholder="https://mon-codespace-3000.app.github.dev"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          value={value}
          onChangeText={setValue}
        />
        <Button title="Enregistrer" large loading={checking} disabled={!value.trim()} onPress={save} />
      </Card>
    </Screen>
  );
}
