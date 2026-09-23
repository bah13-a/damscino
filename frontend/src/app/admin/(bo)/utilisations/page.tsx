'use client';

import { useState } from 'react';
import { defaultFilters, PeriodFilter, type Filters } from '@/components/admin/PeriodFilter';
import { ExportButtons } from '@/components/ExportButtons';
import { Alert, Empty, PageHeader, Pagination, Table } from '@/components/ui';
import { dateTime, dt, percent } from '@/lib/format';
import type { Page, Partner, RejectionRow, UsageRow } from '@/lib/types';
import { query, useApi } from '@/lib/useApi';

const REASONS: Record<string, string> = {
  INVALID_QR: 'QR invalide',
  QR_EXPIRED: 'QR expiré',
  QR_ALREADY_USED: 'QR déjà utilisé',
  SESSION_REPLACED: 'Session remplacée',
  UNKNOWN_ACCOUNT: 'Compte inconnu',
  BENEFICIARY_INACTIVE: 'Bénéficiaire désactivé',
  PARTNER_INACTIVE: 'Partenaire inactif',
  CONVENTION_NOT_STARTED: 'Convention non commencée',
  CONVENTION_EXPIRED: 'Convention expirée',
  QUOTA_REACHED: 'Déjà utilisé sur la période',
};

export default function UsagesPage() {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [tab, setTab] = useState<'usages' | 'rejections'>('usages');
  const [page, setPage] = useState(0);
  const partners = useApi<Partner[]>('admin', '/api/partners');
  const qs = query({ partnerId: filters.partnerId, from: filters.from, to: filters.to });
  const usages = useApi<Page<UsageRow>>('admin', tab === 'usages' ? `/api/reporting/usages${qs}${qs ? '&' : '?'}page=${page}&size=50` : null);
  const rejections = useApi<Page<RejectionRow>>(
    'admin',
    tab === 'rejections' ? `/api/reporting/rejections${qs}${qs ? '&' : '?'}page=${page}&size=50` : null,
  );

  const changeFilters = (f: Filters) => {
    setFilters(f);
    setPage(0);
  };

  return (
    <>
      <PageHeader
        title="Utilisations"
        subtitle="Journal de tous les passages et des refus au scanner."
        actions={
          <ExportButtons
            path={tab === 'usages' ? `/api/reporting/usages/export${qs}` : `/api/reporting/rejections/export${qs}`}
            name={tab === 'usages' ? 'utilisations' : 'refus'}
          />
        }
      />
      <PeriodFilter value={filters} onChange={changeFilters} partners={partners.data ?? []} />
      <div className="mb-4 inline-flex rounded-xl border border-line bg-surface p-1 text-sm">
        {(['usages', 'rejections'] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setPage(0);
            }}
            className={`rounded-lg px-4 py-1.5 font-medium ${tab === t ? 'bg-brand-700 text-white' : 'text-muted'}`}
          >
            {t === 'usages' ? 'Passages' : 'Refus'}
          </button>
        ))}
      </div>

      {tab === 'usages' && (
        <>
          {usages.error && <Alert>{usages.error}</Alert>}
          {usages.data?.items.length === 0 && <Empty>Aucun passage sur la période.</Empty>}
          {usages.data && usages.data.items.length > 0 && (
            <>
              <p className="mb-2 text-sm text-muted">{usages.data.totalItems} passage(s)</p>
              <Table head={['Date et heure', 'Bénéficiaire', 'Partenaire', 'Personnel', 'Prix du plat', 'Remise']}>
                {usages.data.items.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3 tabular-nums">{dateTime(u.validatedAt)}</td>
                    <td className="px-4 py-3 font-medium">{u.beneficiaryName}</td>
                    <td className="px-4 py-3">{u.partnerName}</td>
                    <td className="px-4 py-3">{u.staffName}</td>
                    <td className="px-4 py-3 tabular-nums">{dt(u.dishPrice)}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {dt(u.discountAmount)} <span className="text-xs text-muted">({percent(u.discountPercent)})</span>
                    </td>
                  </tr>
                ))}
              </Table>
              <Pagination page={usages.data.page} totalPages={usages.data.totalPages} onChange={setPage} />
            </>
          )}
        </>
      )}

      {tab === 'rejections' && (
        <>
          {rejections.error && <Alert>{rejections.error}</Alert>}
          {rejections.data?.items.length === 0 && <Empty>Aucun refus sur la période.</Empty>}
          {rejections.data && rejections.data.items.length > 0 && (
            <>
              <Table head={['Date et heure', 'Bénéficiaire', 'Partenaire', 'Personnel', 'Motif', 'Étape']}>
                {rejections.data.items.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 tabular-nums">{dateTime(r.occurredAt)}</td>
                    <td className="px-4 py-3">{r.beneficiaryName ?? '—'}</td>
                    <td className="px-4 py-3">{r.partnerName ?? '—'}</td>
                    <td className="px-4 py-3">{r.staffName}</td>
                    <td className="px-4 py-3 font-medium text-red-700">{REASONS[r.reason] ?? r.reason}</td>
                    <td className="px-4 py-3 text-muted">{r.stage === 'CONFIRM' ? 'Confirmation' : 'Contrôle'}</td>
                  </tr>
                ))}
              </Table>
              <Pagination page={rejections.data.page} totalPages={rejections.data.totalPages} onChange={setPage} />
            </>
          )}
        </>
      )}
    </>
  );
}
