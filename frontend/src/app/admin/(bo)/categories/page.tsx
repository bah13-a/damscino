'use client';

import { useState, type FormEvent } from 'react';
import { Alert, Button, Card, Field, PageHeader } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import type { Category } from '@/lib/types';
import { useApi } from '@/lib/useApi';

export default function CategoriesPage() {
  const categories = useApi<Category[]>('admin', '/api/categories');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const add = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api('admin', '/api/categories', { method: 'POST', body: { label } });
      setLabel('');
      await categories.reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (code: string) => {
    if (!confirm('Supprimer cette catégorie ?')) return;
    setError(null);
    try {
      await api('admin', `/api/categories/${code}`, { method: 'DELETE' });
      await categories.reload();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <>
      <PageHeader
        title="Catégories de la carte"
        subtitle="Catégories définies par Damascino, utilisées pour les règles d'éligibilité de chaque partenaire."
      />
      {(error || categories.error) && <Alert>{error ?? categories.error}</Alert>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <ul className="divide-y divide-line">
            {(categories.data ?? []).map((c) => (
              <li key={c.code} className="flex items-center justify-between py-3">
                <span>
                  {c.label} <span className="ml-2 font-mono text-xs text-muted">{c.code}</span>
                </span>
                <Button size="sm" variant="ghost" onClick={() => remove(c.code)}>
                  Supprimer
                </Button>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <form onSubmit={add} className="space-y-4">
            <h2 className="font-display text-lg font-semibold">Ajouter une catégorie</h2>
            <Field label="Libellé" required value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex. Grillades" />
            <Button type="submit" loading={saving}>
              Ajouter
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
