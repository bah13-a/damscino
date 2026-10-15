'use client';

import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import type { Beneficiary, IssuedCredentials, Partner } from '@/lib/types';
import { Alert, Button, Field, Select } from '../ui';

/** Manual addition (returns the generated access) or edition of a beneficiary. */
export function BeneficiaryForm({
  beneficiary,
  partners,
  defaultPartnerId,
  onCreated,
  onUpdated,
}: {
  beneficiary?: Beneficiary;
  partners: Partner[];
  defaultPartnerId?: string;
  onCreated?: (c: IssuedCredentials) => void;
  onUpdated?: (b: Beneficiary) => void;
}) {
  const [form, setForm] = useState({
    partnerId: beneficiary?.partnerId ?? defaultPartnerId ?? partners[0]?.id ?? '',
    lastName: beneficiary?.lastName ?? '',
    firstName: beneficiary?.firstName ?? '',
    phone: beneficiary?.phone ?? '',
    email: beneficiary?.email ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm({ ...form, [key]: event.target.value });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (beneficiary) {
        onUpdated?.(await api<Beneficiary>('admin', `/api/beneficiaries/${beneficiary.id}`, { method: 'PUT', body: form }));
      } else {
        onCreated?.(await api<IssuedCredentials>('admin', '/api/beneficiaries', { method: 'POST', body: form }));
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert>{error}</Alert>}
      <Select label="Partenaire" value={form.partnerId} onChange={set('partnerId')} required>
        {partners.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom" required value={form.lastName} onChange={set('lastName')} />
        <Field label="Prénom" required value={form.firstName} onChange={set('firstName')} />
      </div>
      <Field label="Téléphone (identifiant)" type="tel" required value={form.phone} onChange={set('phone')} hint="8 chiffres, ex. 98 123 456" />
      <Field
        label="E-mail (facultatif)"
        type="email"
        value={form.email}
        onChange={set('email')}
        hint="Le code d'activation y est aussi envoyé, en plus du SMS"
      />
      <Button type="submit" loading={saving} className="w-full">
        {beneficiary ? 'Enregistrer' : 'Ajouter et générer les accès'}
      </Button>
    </form>
  );
}
