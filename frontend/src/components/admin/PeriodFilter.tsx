'use client';

import { isoDaysAgo, todayIso } from '@/lib/format';
import type { Partner } from '@/lib/types';
import { Select } from '../ui';

export interface Filters {
  partnerId: string;
  from: string;
  to: string;
}

export const defaultFilters = (): Filters => ({ partnerId: '', from: isoDaysAgo(29), to: todayIso() });

const PRESETS = [
  { label: "Aujourd'hui", from: () => todayIso() },
  { label: '7 jours', from: () => isoDaysAgo(6) },
  { label: '30 jours', from: () => isoDaysAgo(29) },
  { label: '12 mois', from: () => isoDaysAgo(364) },
];

/** Filters shared by statistics and logs: partner (global when empty) and period. */
export function PeriodFilter({ value, onChange, partners }: { value: Filters; onChange: (f: Filters) => void; partners: Partner[] }) {
  return (
    <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 md:flex-row md:items-end">
      <Select label="Partenaire" value={value.partnerId} onChange={(e) => onChange({ ...value, partnerId: e.target.value })} className="md:w-56">
        <option value="">Tous les partenaires</option>
        {partners.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
      <label className="text-sm font-medium">
        Du
        <input
          type="date"
          value={value.from}
          max={value.to}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
          className="mt-1 block w-full rounded-xl border border-line bg-surface px-3 py-2"
        />
      </label>
      <label className="text-sm font-medium">
        Au
        <input
          type="date"
          value={value.to}
          min={value.from}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
          className="mt-1 block w-full rounded-xl border border-line bg-surface px-3 py-2"
        />
      </label>
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => onChange({ ...value, from: preset.from(), to: todayIso() })}
            className="rounded-lg border border-line px-2.5 py-2 text-xs font-medium hover:bg-canvas"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
