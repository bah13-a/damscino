'use client';

import { useEffect, useState } from 'react';
import { ExportButtons } from '@/components/ExportButtons';
import { Alert, Empty, PageHeader, Pagination, Table } from '@/components/ui';
import { dateTime } from '@/lib/format';
import type { AuditRow, Page } from '@/lib/types';
import { query, useApi } from '@/lib/useApi';

const ACTIONS: Record<string, string> = {
  PARTNER_CREATED: 'Partenaire créé',
  PARTNER_UPDATED: 'Partenaire modifié',
  PARTNER_ACTIVATED: 'Partenaire activé',
  PARTNER_DEACTIVATED: 'Partenaire désactivé',
  ADVANTAGE_RULE_UPDATED: 'Règle modifiée',
  BENEFICIARY_CREATED: 'Bénéficiaire ajouté',
  BENEFICIARY_UPDATED: 'Bénéficiaire modifié',
  BENEFICIARY_DEACTIVATED: 'Bénéficiaire désactivé',
  BENEFICIARY_REACTIVATED: 'Bénéficiaire réactivé',
  BENEFICIARY_PASSWORD_RESET: 'Mot de passe réinitialisé',
  BENEFICIARIES_IMPORTED: 'Import de liste',
  CATEGORY_SAVED: 'Catégorie enregistrée',
  CATEGORY_DELETED: 'Catégorie supprimée',
  ACCOUNT_CREATED: 'Compte créé',
  ACCOUNT_UPDATED: 'Compte modifié',
  ACCOUNT_SECRET_RESET: 'Mot de passe / PIN réinitialisé',
  SNAPSHOTS_REPUBLISHED: 'Resynchronisation',
};

export default function AuditPage() {
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(text);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [text]);
  const audit = useApi<Page<AuditRow>>('admin', `/api/reporting/audit${query({ q: search, page, size: 50 })}`);

  return (
    <>
      <PageHeader
        title="Journal d'administration"
        subtitle="Chaque action d'administration est tracée avec son auteur et l'horodatage."
        actions={<ExportButtons path={`/api/reporting/audit/export${query({ q: search })}`} name="journal" />}
      />
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Rechercher (auteur, action, détail)"
        className="mb-4 w-full rounded-xl border border-line bg-surface px-3 py-2.5 md:max-w-md"
      />
      {audit.error && <Alert>{audit.error}</Alert>}
      {audit.data?.items.length === 0 && <Empty>Aucune action enregistrée.</Empty>}
      {audit.data && audit.data.items.length > 0 && (
        <>
          <Table head={['Date et heure', 'Auteur', 'Action', 'Détails']}>
            {audit.data.items.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-3 tabular-nums">{dateTime(a.occurredAt)}</td>
                <td className="px-4 py-3">{a.actorName}</td>
                <td className="px-4 py-3 font-medium">{ACTIONS[a.action] ?? a.action}</td>
                <td className="px-4 py-3 text-muted">{a.details}</td>
              </tr>
            ))}
          </Table>
          <Pagination page={audit.data.page} totalPages={audit.data.totalPages} onChange={setPage} />
        </>
      )}
    </>
  );
}
