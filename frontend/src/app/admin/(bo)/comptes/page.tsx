'use client';

import { useState, type FormEvent } from 'react';
import { Alert, Badge, Button, Field, Modal, PageHeader, Select, Table } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { dateTime } from '@/lib/format';
import type { Account, Role } from '@/lib/types';
import { useApi } from '@/lib/useApi';
import { getSession } from '@/lib/session';

function CreateAccountForm({ onCreated }: { onCreated: () => void }) {
  const [role, setRole] = useState<Role>('STAFF');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api('admin', '/api/accounts', { method: 'POST', body: { role, username, displayName, secret } });
      onCreated();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert>{error}</Alert>}
      <Select label="Rôle" value={role} onChange={(e) => setRole(e.target.value as Role)}>
        <option value="STAFF">Personnel scanner (serveur, caissier)</option>
        <option value="ADMIN">Administrateur</option>
      </Select>
      <Field label="Identifiant" required value={username} onChange={(e) => setUsername(e.target.value)} hint="ex. caisse1, sami.b" autoCapitalize="none" />
      <Field label="Nom affiché" value={displayName} onChange={(e) => setDisplayName(e.target.value)} hint="Apparaît dans le journal des passages" />
      <Field
        label={role === 'STAFF' ? 'Code PIN' : 'Mot de passe provisoire'}
        type="password"
        inputMode={role === 'STAFF' ? 'numeric' : undefined}
        required
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        hint={role === 'STAFF' ? '4 à 8 chiffres' : '8 caractères minimum, à changer à la première connexion'}
      />
      <Button type="submit" loading={saving} className="w-full">
        Créer le compte
      </Button>
    </form>
  );
}

export default function AccountsPage() {
  const accounts = useApi<Account[]>('admin', '/api/accounts');
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<Account | null>(null);
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const me = typeof window === 'undefined' ? null : getSession('admin')?.accountId;

  const act = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      await accounts.reload();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <>
      <PageHeader
        title="Comptes"
        subtitle="Administrateurs et personnel scanner, avec des rôles distincts."
        actions={<Button onClick={() => setCreating(true)}>Nouveau compte</Button>}
      />
      {(error || accounts.error) && <Alert>{error ?? accounts.error}</Alert>}
      {accounts.data && (
        <Table head={['Nom', 'Identifiant', 'Rôle', 'Statut', 'Dernière connexion', '']}>
          {accounts.data.map((a) => (
            <tr key={a.id} className={a.active ? '' : 'opacity-60'}>
              <td className="px-4 py-3 font-medium">{a.displayName}</td>
              <td className="px-4 py-3 font-mono">{a.username}</td>
              <td className="px-4 py-3">{a.role === 'ADMIN' ? <Badge tone="brand">Administrateur</Badge> : <Badge>Scanner</Badge>}</td>
              <td className="px-4 py-3">
                {!a.active ? <Badge tone="danger">Désactivé</Badge> : a.locked ? <Badge tone="warning">Bloqué</Badge> : <Badge tone="success">Actif</Badge>}
              </td>
              <td className="px-4 py-3 text-muted">{dateTime(a.lastLoginAt)}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => { setSecret(''); setResetting(a); }}>
                    {a.role === 'STAFF' ? 'Nouveau PIN' : 'Nouveau mot de passe'}
                  </Button>
                  {a.id !== me && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => act(() => api('admin', `/api/accounts/${a.id}`, { method: 'PATCH', body: { active: !a.active } }))}
                    >
                      {a.active ? 'Désactiver' : 'Réactiver'}
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}
      <Modal open={creating} title="Nouveau compte" onClose={() => setCreating(false)}>
        <CreateAccountForm
          onCreated={() => {
            setCreating(false);
            accounts.reload();
          }}
        />
      </Modal>
      <Modal open={resetting !== null} title={`Réinitialiser · ${resetting?.displayName ?? ''}`} onClose={() => setResetting(null)}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const account = resetting!;
            act(() => api('admin', `/api/accounts/${account.id}/reset-secret`, { method: 'POST', body: { secret } })).then(() => setResetting(null));
          }}
        >
          <Field
            label={resetting?.role === 'STAFF' ? 'Nouveau code PIN' : 'Nouveau mot de passe provisoire'}
            type="password"
            required
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            hint="Le compte est débloqué et ses sessions ouvertes sont fermées."
          />
          <Button type="submit" className="w-full">
            Enregistrer
          </Button>
        </form>
      </Modal>
    </>
  );
}
