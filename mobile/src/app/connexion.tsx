import { router, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';
import { AuthHeader } from '@/components/AuthHeader';
import { Screen } from '@/components/Screen';
import { Alert, Button, Card, Field, T } from '@/components/ui';
import { api, errorMessage, login, requestSmsCode, verifySmsCode, type SmsCodeSent } from '@/lib/api';
import { SERVER_CHANGE_ALLOWED, server } from '@/lib/config';
import type { Space } from '@/lib/types';
import { homeOf } from '@/lib/useSession';

const PARTNER_ID = /^[0-9a-f-]{36}$/i;

export default function LoginScreen() {
  const params = useLocalSearchParams<{ espace?: string; expire?: string; p?: string; mode?: string }>();
  const space: Space = params.espace === 'staff' ? 'staff' : 'beneficiary';
  const partnerId = params.p && PARTNER_ID.test(params.p) ? params.p : undefined;
  const [partner, setPartner] = useState<string | null>(null);

  // opened from a partner activation link: welcome its employees by name
  useEffect(() => {
    if (!partnerId) return;
    api<{ name: string; active: boolean }>(`/api/partners/${partnerId}/public`, { anonymous: true })
      .then((p) => p.active && setPartner(p.name))
      .catch(() => undefined);
  }, [partnerId]);

  const expired = params.expire ? (
    <Alert tone="info">
      {params.expire === 'replaced'
        ? 'Votre compte s’est connecté sur un autre téléphone. Reconnectez-vous pour continuer ici.'
        : 'Votre session a expiré. Reconnectez-vous.'}
    </Alert>
  ) : null;

  const beneficiaryBySms = space === 'beneficiary' && params.mode !== 'password';
  const title = space === 'staff' ? 'Espace personnel' : 'Espace bénéficiaire';
  const subtitle = partner
    ? `Bienvenue aux collaborateurs de ${partner}.`
    : space === 'staff'
      ? 'Scanner des QR codes Damascino Privilèges en caisse.'
      : beneficiaryBySms
        ? 'Saisissez le numéro de téléphone communiqué à votre entreprise : vous recevrez un code par SMS.'
        : "Connectez-vous avec l'identifiant et le mot de passe remis par votre entreprise.";

  return (
    <Screen header={<AuthHeader title={title} subtitle={subtitle} />}>
      <Card style={{ gap: 16 }}>
        {beneficiaryBySms ? <SmsLogin partnerId={partnerId} notice={expired} /> : <PasswordLogin space={space} notice={expired} />}
        {space === 'beneficiary' && (
          <T
            variant="small"
            style={{ textAlign: 'center', textDecorationLine: 'underline' }}
            accessibilityRole="link"
            onPress={() => router.setParams({ mode: beneficiaryBySms ? 'password' : 'sms' })}
          >
            {beneficiaryBySms ? "J'ai un mot de passe" : 'Recevoir un code par SMS'}
          </T>
        )}
        {SERVER_CHANGE_ALLOWED && (
          <T
            variant="small"
            style={{ textAlign: 'center', textDecorationLine: 'underline' }}
            accessibilityRole="link"
            onPress={() => router.push({ pathname: '/serveur', params: { espace: space } })}
          >
            Serveur : {server() || 'non configuré'} · Modifier
          </T>
        )}
      </Card>
    </Screen>
  );
}

/** Activation and sign-in of beneficiaries: phone number, then the 6-digit code received by SMS. */
function SmsLogin({ partnerId, notice }: { partnerId?: string; notice: ReactNode }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState<SmsCodeSent | null>(null);
  const [wait, setWait] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const send = async () => {
    setError(null);
    setLoading(true);
    try {
      const result = await requestSmsCode(phone, partnerId);
      setSent(result);
      setCode('');
      setWait(result.resendIn);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    setError(null);
    setLoading(true);
    try {
      const session = await verifySmsCode(phone, code);
      router.replace(homeOf(session));
    } catch (e) {
      setError(errorMessage(e));
      setLoading(false);
    }
  };

  if (!sent) {
    return (
      <>
        {!error && notice}
        {error && <Alert>{error}</Alert>}
        <Field
          label="Numéro de téléphone"
          placeholder="98 123 456"
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          value={phone}
          onChangeText={setPhone}
          returnKeyType="go"
          onSubmitEditing={send}
        />
        <Button title="Recevoir le code par SMS" large loading={loading} disabled={phone.replace(/\D/g, '').length < 8} onPress={send} />
      </>
    );
  }

  return (
    <>
      {error ? (
        <Alert>{error}</Alert>
      ) : (
        <Alert tone="success">Code envoyé par SMS au {sent.maskedPhone}. Il est valable {Math.round(sent.expiresIn / 60)} minutes.</Alert>
      )}
      {sent.devCode && (
        <Alert tone="warning">Environnement de test : aucun SMS n’est envoyé. Votre code est {sent.devCode}.</Alert>
      )}
      <Field
        label="Code reçu par SMS"
        placeholder="6 chiffres"
        keyboardType="number-pad"
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        maxLength={6}
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
        returnKeyType="go"
        onSubmitEditing={verify}
        style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center' }}
      />
      <Button title="Valider" large loading={loading} disabled={code.length !== 6} onPress={verify} />
      <Button
        title={wait > 0 ? `Renvoyer un code (${wait} s)` : 'Renvoyer un code'}
        variant="secondary"
        disabled={wait > 0 || loading}
        onPress={send}
      />
      <T
        variant="small"
        style={{ textAlign: 'center', textDecorationLine: 'underline' }}
        accessibilityRole="link"
        onPress={() => {
          setSent(null);
          setError(null);
        }}
      >
        Modifier le numéro
      </T>
    </>
  );
}

const PASSWORD_LABELS: Record<Space, { username: string; placeholder: string; secret: string }> = {
  beneficiary: { username: 'Identifiant (numéro de téléphone)', placeholder: '98 123 456', secret: 'Mot de passe' },
  staff: { username: 'Identifiant', placeholder: 'ex. caisse1', secret: 'Code PIN' },
};

function PasswordLogin({ space, notice }: { space: Space; notice: ReactNode }) {
  const labels = PASSWORD_LABELS[space];
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    <>
      {!error && notice}
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
    </>
  );
}
