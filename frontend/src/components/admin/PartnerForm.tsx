'use client';

import { useState, type FormEvent } from 'react';
import { api, ApiError, errorMessage } from '@/lib/api';
import type { Partner } from '@/lib/types';
import { Alert, Button, Field } from '../ui';

/** Partner profile and convention period (the advantage rule is edited separately). */
export function PartnerForm({ partner, onSaved }: { partner?: Partner; onSaved: (p: Partner) => void }) {
  const year = new Date().getFullYear();
  const [form, setForm] = useState({
    name: partner?.name ?? '',
    contactName: partner?.contactName ?? '',
    contactPhone: partner?.contactPhone ?? '',
    contactEmail: partner?.contactEmail ?? '',
    conventionStart: partner?.conventionStart ?? `${year}-01-01`,
    conventionEnd: partner?.conventionEnd ?? `${year}-12-31`,
  });
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm({ ...form, [key]: event.target.value });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const saved = await api<Partner>('admin', partner ? `/api/partners/${partner.id}` : '/api/partners', {
        method: partner ? 'PUT' : 'POST',
        body: form,
      });
      onSaved(saved);
    } catch (e) {
      setError(errorMessage(e));
      setFields(e instanceof ApiError ? e.fields : {});
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert>{error}</Alert>}
      <Field label="Nom du partenaire" required value={form.name} onChange={set('name')} error={fields.name} placeholder="Mall of Sfax" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Début de convention" type="date" required value={form.conventionStart} onChange={set('conventionStart')} />
        <Field label="Fin de convention" type="date" required value={form.conventionEnd} onChange={set('conventionEnd')} />
      </div>
      <Field label="Contact" value={form.contactName} onChange={set('contactName')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Téléphone du contact" type="tel" value={form.contactPhone} onChange={set('contactPhone')} />
        <Field label="E-mail du contact" type="email" value={form.contactEmail} onChange={set('contactEmail')} />
      </div>
      {!partner && <p className="text-xs text-muted">Règle par défaut : −20 % sur un plat par jour, boissons et desserts exclus (modifiable ensuite).</p>}
      <Button type="submit" loading={saving} className="w-full">
        Enregistrer
      </Button>
    </form>
  );
}
