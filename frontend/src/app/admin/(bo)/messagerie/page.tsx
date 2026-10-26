'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Badge, Button, Card, Field, PageHeader } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { dateTime } from '@/lib/format';
import type { MailSettings } from '@/lib/types';
import { useApi } from '@/lib/useApi';

const SOURCES: Record<MailSettings['source'], { tone: 'success' | 'warning' | 'danger'; label: string }> = {
  ADMIN: { tone: 'success', label: 'Configurée' },
  SERVER: { tone: 'warning', label: 'Configuration du serveur' },
  NONE: { tone: 'danger', label: 'Non configurée' },
};

/** Administration → Messagerie: the e-mail account that sends the activation codes to the beneficiaries. */
export default function MailSettingsPage() {
  const settings = useApi<MailSettings>('admin', '/api/mail-settings');
  const [form, setForm] = useState({ username: '', password: '', fromAddress: '', host: 'smtp.gmail.com', port: '587' });
  const [testTo, setTestTo] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState<'save' | 'test' | 'reset' | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  useEffect(() => {
    const s = settings.data;
    if (!s) return;
    setForm({ username: s.username, password: '', fromAddress: s.fromAddress, host: s.host, port: String(s.port) });
    setAdvanced(s.host !== 'smtp.gmail.com' || s.port !== 587 || (!!s.fromAddress && s.fromAddress !== s.username));
  }, [settings.data]);

  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm({ ...form, [key]: event.target.value });
  const body = () => ({ ...form, port: Number(form.port) || 587 });

  const run = async (kind: 'save' | 'test' | 'reset', action: () => Promise<string>) => {
    setBusy(kind);
    setMessage(null);
    try {
      setMessage({ tone: 'success', text: await action() });
    } catch (e) {
      setMessage({ tone: 'danger', text: errorMessage(e) });
    } finally {
      setBusy(null);
    }
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    run('save', async () => {
      settings.setData(await api<MailSettings>('admin', '/api/mail-settings', { method: 'PUT', body: body() }));
      return 'Messagerie enregistrée : les prochains codes partiront depuis ce compte.';
    });
  };

  const test = () =>
    run('test', async () => {
      await api('admin', '/api/mail-settings/test', { method: 'POST', body: { ...body(), to: testTo } });
      return `E-mail de test envoyé à ${testTo}. Vérifiez la boîte de réception (et les courriers indésirables).`;
    });

  const reset = () => {
    if (!window.confirm('Supprimer ce compte de messagerie ? Les codes partiront avec la configuration du serveur, ou par SMS.')) return;
    run('reset', async () => {
      settings.setData(await api<MailSettings>('admin', '/api/mail-settings', { method: 'DELETE' }));
      return 'Compte de messagerie supprimé.';
    });
  };

  const s = settings.data;
  const source = s ? SOURCES[s.source] : null;

  return (
    <>
      <PageHeader
        title="Messagerie"
        subtitle="Compte e-mail qui envoie les codes d'activation aux bénéficiaires (le SMS ne sert qu'en secours)."
        actions={source && <Badge tone={source.tone}>{source.label}</Badge>}
      />
      {settings.error && <Alert>{settings.error}</Alert>}
      {s && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card>
            <form onSubmit={save} className="space-y-4">
              {message && <Alert tone={message.tone}>{message.text}</Alert>}
              {s.source === 'ADMIN' && s.updatedAt && (
                <p className="text-sm text-muted">
                  Modifiée le {dateTime(s.updatedAt)} par {s.updatedBy}.
                </p>
              )}
              {s.source === 'SERVER' && (
                <p className="text-sm text-muted">
                  Les codes partent actuellement avec le compte configuré sur le serveur. Un compte saisi ici le remplace.
                </p>
              )}
              <Field
                label="Adresse e-mail"
                type="email"
                required
                autoComplete="off"
                placeholder="damascino.privileges@gmail.com"
                value={form.username}
                onChange={set('username')}
                hint="Compte Gmail qui enverra les codes"
              />
              <Field
                label="Mot de passe d'application"
                type="password"
                autoComplete="new-password"
                required={!s.passwordSet}
                placeholder={s.passwordSet ? '•••••••••••••••• (enregistré)' : 'abcd efgh ijkl mnop'}
                value={form.password}
                onChange={set('password')}
                hint={
                  s.passwordSet
                    ? 'Laissez vide pour garder le mot de passe enregistré.'
                    : '16 lettres données par Google (pas le mot de passe Gmail), voir l’aide à droite.'
                }
              />
              <button type="button" className="text-sm font-medium text-brand-700 underline" onClick={() => setAdvanced(!advanced)}>
                {advanced ? 'Masquer les paramètres avancés' : 'Paramètres avancés (autre messagerie que Gmail)'}
              </button>
              {advanced && (
                <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
                  <Field label="Serveur SMTP" value={form.host} onChange={set('host')} hint="smtp.gmail.com pour Gmail" />
                  <Field label="Port" inputMode="numeric" value={form.port} onChange={set('port')} hint="587 ou 465" />
                  <Field
                    className="sm:col-span-2"
                    label="Adresse d'expédition"
                    type="email"
                    value={form.fromAddress}
                    onChange={set('fromAddress')}
                    hint="Vide = l'adresse e-mail ci-dessus (obligatoire avec Gmail)"
                  />
                </div>
              )}
              <div className="rounded-xl border border-line p-4">
                <Field
                  label="Envoyer un e-mail de test à"
                  type="email"
                  placeholder="votre.adresse@exemple.tn"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  hint="Vérifie l'adresse et le mot de passe avant d'enregistrer"
                />
                <Button type="button" variant="secondary" className="mt-3" loading={busy === 'test'} disabled={!testTo || !form.username} onClick={test}>
                  Envoyer un e-mail de test
                </Button>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="submit" loading={busy === 'save'}>
                  Enregistrer
                </Button>
                {s.source === 'ADMIN' && (
                  <Button type="button" variant="ghost" loading={busy === 'reset'} onClick={reset}>
                    Supprimer ce compte
                  </Button>
                )}
              </div>
            </form>
          </Card>
          <Card className="h-fit text-sm">
            <h2 className="font-display text-base font-semibold">Créer le mot de passe Gmail (gratuit)</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted">
              <li>Utilisez un compte Gmail dédié, par exemple damascino.privileges@gmail.com.</li>
              <li>
                Activez la <strong className="text-ink">validation en deux étapes</strong> : myaccount.google.com → Sécurité.
              </li>
              <li>
                Ouvrez <strong className="text-ink">myaccount.google.com/apppasswords</strong>, nommez-le « Damascino » puis
                « Créer ».
              </li>
              <li>Copiez les 16 lettres affichées dans « Mot de passe d&apos;application » (les espaces sont acceptés).</li>
              <li>Envoyez un e-mail de test, puis enregistrez.</li>
            </ol>
            <p className="mt-3 text-muted">Gmail permet environ 500 e-mails par jour. Le mot de passe est conservé chiffré et n&apos;est jamais réaffiché.</p>
          </Card>
        </div>
      )}
    </>
  );
}
