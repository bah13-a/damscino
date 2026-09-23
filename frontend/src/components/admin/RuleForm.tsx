'use client';

import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import type { Category, Partner, UsagePeriod } from '@/lib/types';
import { Alert, Button, Field, Select } from '../ui';

type Choice = 'eligible' | 'excluded' | 'neutral';

/** Advantage rule of a partner: percentage, eligible / excluded categories, usages per period. */
export function RuleForm({ partner, categories, onSaved }: { partner: Partner; categories: Category[]; onSaved: (p: Partner) => void }) {
  const [percent, setPercent] = useState(String(partner.discountPercent));
  const [usages, setUsages] = useState(String(partner.usagesPerPeriod));
  const [period, setPeriod] = useState<UsagePeriod>(partner.usagePeriod);
  const [choices, setChoices] = useState<Record<string, Choice>>(() =>
    Object.fromEntries(
      categories.map((c) => [
        c.code,
        partner.eligibleCategories.includes(c.code) ? 'eligible' : partner.excludedCategories.includes(c.code) ? 'excluded' : 'neutral',
      ]),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const saved = await api<Partner>('admin', `/api/partners/${partner.id}/rule`, {
        method: 'PUT',
        body: {
          discountPercent: Number(percent.replace(',', '.')),
          usagesPerPeriod: Number(usages),
          usagePeriod: period,
          eligibleCategories: Object.keys(choices).filter((code) => choices[code] === 'eligible'),
          excludedCategories: Object.keys(choices).filter((code) => choices[code] === 'excluded'),
        },
      });
      onSaved(saved);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert>{error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Remise (%)" inputMode="decimal" required value={percent} onChange={(e) => setPercent(e.target.value)} />
        <Field label="Utilisations" type="number" min={1} max={100} required value={usages} onChange={(e) => setUsages(e.target.value)} />
        <Select label="Par" value={period} onChange={(e) => setPeriod(e.target.value as UsagePeriod)}>
          <option value="DAY">jour</option>
          <option value="WEEK">semaine</option>
          <option value="MONTH">mois</option>
        </Select>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Catégories</legend>
        <div className="divide-y divide-line rounded-xl border border-line">
          {categories.map((category) => (
            <div key={category.code} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span>{category.label}</span>
              <div className="flex overflow-hidden rounded-lg border border-line text-xs">
                {(['eligible', 'neutral', 'excluded'] as Choice[]).map((choice) => (
                  <button
                    type="button"
                    key={choice}
                    onClick={() => setChoices({ ...choices, [category.code]: choice })}
                    className={`px-2.5 py-1.5 font-medium ${
                      choices[category.code] === choice
                        ? choice === 'eligible'
                          ? 'bg-emerald-600 text-white'
                          : choice === 'excluded'
                            ? 'bg-red-600 text-white'
                            : 'bg-line text-ink'
                        : 'text-muted'
                    }`}
                  >
                    {choice === 'eligible' ? 'Éligible' : choice === 'excluded' ? 'Exclue' : '—'}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </fieldset>
      <Button type="submit" loading={saving} className="w-full">
        Enregistrer la règle
      </Button>
    </form>
  );
}
