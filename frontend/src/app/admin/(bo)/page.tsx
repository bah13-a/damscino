'use client';

import { useState } from 'react';
import { DailyChart } from '@/components/admin/DailyChart';
import { defaultFilters, PeriodFilter, type Filters } from '@/components/admin/PeriodFilter';
import { ExportButtons } from '@/components/ExportButtons';
import { Alert, Badge, Card, PageHeader, Spinner, Table } from '@/components/ui';
import { dt } from '@/lib/format';
import type { Partner, Statistics } from '@/lib/types';
import { query, useApi } from '@/lib/useApi';

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="!p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

export default function AdminDashboardPage() {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const partners = useApi<Partner[]>('admin', '/api/partners');
  const qs = query({ partnerId: filters.partnerId, from: filters.from, to: filters.to });
  const stats = useApi<Statistics>('admin', `/api/reporting/statistics${qs}`);
  const t = stats.data?.totals;

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        subtitle="Autorisés, comptes activés, utilisateurs actifs, passages et remises accordées."
        actions={<ExportButtons path={`/api/reporting/statistics/export${qs}`} name="statistiques" />}
      />
      <PeriodFilter value={filters} onChange={setFilters} partners={partners.data ?? []} />
      {stats.error && <Alert>{stats.error}</Alert>}
      {!t && !stats.error && (
        <div className="flex justify-center py-16 text-brand-700">
          <Spinner />
        </div>
      )}
      {t && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi label="Autorisés" value={t.authorized} hint="bénéficiaires actifs" />
            <Kpi
              label="Comptes activés"
              value={t.activated}
              hint={t.authorized ? `${Math.round((t.activated / t.authorized) * 100)} % des autorisés` : undefined}
            />
            <Kpi label="Utilisateurs actifs" value={t.activeUsers} hint="au moins 1 passage" />
            <Kpi label="Passages" value={t.redemptions} hint={`${t.refusals} refus`} />
            <Kpi label="Remises accordées" value={dt(t.discountTotal)} hint={`sur ${dt(t.dishTotal)} de plats`} />
          </div>

          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Passages par jour</h2>
              <ExportButtons path={`/api/reporting/statistics/export${qs}${qs ? '&' : '?'}table=days`} name="statistiques-par-jour" label="" />
            </div>
            <DailyChart days={stats.data!.byDay} from={filters.from} to={filters.to} />
          </Card>

          <div>
            <h2 className="mb-3 font-display text-lg font-semibold">Par partenaire</h2>
            <Table head={['Partenaire', 'Autorisés', 'Activés', 'Actifs', 'Passages', 'Remises']}>
              {stats.data!.byPartner.map((p) => (
                <tr key={p.partnerId}>
                  <td className="px-4 py-3 font-medium">
                    {p.partnerName} {!p.active && <Badge tone="danger">inactif</Badge>}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{p.authorized}</td>
                  <td className="px-4 py-3 tabular-nums">{p.activated}</td>
                  <td className="px-4 py-3 tabular-nums">{p.activeUsers}</td>
                  <td className="px-4 py-3 tabular-nums">{p.redemptions}</td>
                  <td className="px-4 py-3 tabular-nums">{dt(p.discountTotal)}</td>
                </tr>
              ))}
            </Table>
          </div>
        </div>
      )}
    </>
  );
}
