import { router } from 'expo-router';
import { useState } from 'react';
import { AuthHeader } from '@/components/AuthHeader';
import { Screen } from '@/components/Screen';
import { Alert, Button, Card, Field } from '@/components/ui';
import { CLIENT_HEADER } from '@/lib/api';
import { normalizeServer, saveServer, server } from '@/lib/config';

/** Test builds only: point the app to the address of a test server (Codespace, demo…). */
export default function ServerScreen() {
  const [value, setValue] = useState(server());
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const save = async () => {
    setError(null);
    setChecking(true);
    const url = normalizeServer(value);
    try {
      // the API answers 401 on /api/auth/me without a session: proof it is a Damascino server
      const response = await fetch(`${url}/api/auth/me`, { headers: CLIENT_HEADER });
      if (response.status !== 401 && !response.ok) throw new Error();
      await saveServer(url);
      router.replace('/bienvenue');
    } catch {
      setError('Serveur injoignable à cette adresse.');
      setChecking(false);
    }
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
