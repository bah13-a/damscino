'use client';

import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { phone, shortDate } from '@/lib/format';
import type { Beneficiary, IssuedCredentials, Page, Partner } from '@/lib/types';
import { query, useApi } from '@/lib/useApi';
import { ExportButtons } from '../ExportButtons';
import { Alert, Badge, Button, Empty, Modal, Pagination, Select, Table } from '../ui';
import { BeneficiaryForm } from './BeneficiaryForm';
import { BeneficiaryHistory } from './BeneficiaryHistory';
import { CredentialsModal } from './CredentialsModal';

/**
 * Searchable list of beneficiaries (by name or phone) with manual addition, edition, deactivation / reactivation,
 * password reset and history. Restricted to one partner when {@code partnerId} is given.
 */
export function BeneficiaryTable({ partners, partnerId, refreshKey = 0 }: { partners: Partner[]; partnerId?: string; refreshKey?: number }) {
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [partnerFilter, setPartnerFilter] = useState(partnerId ?? '');
  const [page, setPage] = useState(0);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Beneficiary | null>(null);
  const [history, setHistory] = useState<Beneficiary | null>(null);
  const [credentials, setCredentials] = useState<IssuedCredentials | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(text);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [text]);

  const filters = { q: search, partnerId: partnerId ?? partnerFilter, active: status };
  const list = useApi<Page<Beneficiary>>('admin', `/api/beneficiaries${query({ ...filters, page, size: 25 })}`);
  const { reload } = list;
  useEffect(() => {
    if (refreshKey) reload();
  }, [refreshKey, reload]);

  const act = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      await reload();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <label className="flex-1 text-sm font-medium">
          Recherche
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Nom, prénom ou téléphone"
            className="mt-1 block w-full rounded-xl border border-line bg-surface px-3 py-2.5"
          />
        </label>
        {!partnerId && (
          <Select label="Partenaire" value={partnerFilter} onChange={(e) => { setPartnerFilter(e.target.value); setPage(0); }} className="md:w-52">
            <option value="">Tous</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        )}
        <Select label="Statut" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} className="md:w-40">
          <option value="">Tous</option>
          <option value="true">Actifs</option>
          <option value="false">Désactivés</option>
        </Select>
        <div className="flex gap-2">
          <ExportButtons path={`/api/beneficiaries/export${query(filters)}`} name="beneficiaires" />
          <Button onClick={() => setAdding(true)} disabled={partners.length === 0}>
            Ajouter
          </Button>
        </div>
      </div>

      {(error || list.error) && <Alert>{error ?? list.error}</Alert>}
      {list.data && list.data.items.length === 0 && <Empty>Aucun bénéficiaire trouvé.</Empty>}
      {list.data && list.data.items.length > 0 && (
        <>
          <p className="text-sm text-muted">{list.data.totalItems} bénéficiaire(s)</p>
          <Table head={['Nom', 'Téléphone', ...(partnerId ? [] : ['Partenaire']), 'Compte', 'Ajouté le', '']}>
            {list.data.items.map((b) => (
              <tr key={b.id} className={b.active ? '' : 'opacity-60'}>
                <td className="px-4 py-3 font-medium">
                  {b.lastName} {b.firstName}
                </td>
                <td className="px-4 py-3 font-mono tabular-nums">{phone(b.phone)}</td>
                {!partnerId && <td className="px-4 py-3">{b.partnerName}</td>}
                <td className="px-4 py-3">
                  {!b.active ? (
                    <Badge tone="danger">Désactivé</Badge>
                  ) : b.accountActivated ? (
                    <Badge tone="success">Activé</Badge>
                  ) : (
                    <Badge tone="warning">À activer</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-muted">{shortDate(b.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setHistory(b)}>
                      Historique
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(b)}>
                      Modifier
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        confirm(`Réinitialiser le mot de passe de ${b.firstName} ${b.lastName} ?`) &&
                        act(async () => setCredentials(await api<IssuedCredentials>('admin', `/api/beneficiaries/${b.id}/reset-password`, { method: 'POST' })))
                      }
                    >
                      Réinitialiser
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => act(() => api('admin', `/api/beneficiaries/${b.id}/status`, { method: 'PATCH', body: { active: !b.active } }))}
                    >
                      {b.active ? 'Désactiver' : 'Réactiver'}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
          <Pagination page={list.data.page} totalPages={list.data.totalPages} onChange={setPage} />
        </>
      )}

      <Modal open={adding} title="Ajouter un bénéficiaire" onClose={() => setAdding(false)}>
        <BeneficiaryForm
          partners={partners}
          defaultPartnerId={partnerId ?? (partnerFilter || undefined)}
          onCreated={(c) => {
            setAdding(false);
            setCredentials(c);
            reload();
          }}
        />
      </Modal>
      <Modal open={editing !== null} title="Modifier le bénéficiaire" onClose={() => setEditing(null)}>
        {editing && (
          <BeneficiaryForm
            beneficiary={editing}
            partners={partners}
            onUpdated={() => {
              setEditing(null);
              reload();
            }}
          />
        )}
      </Modal>
      <BeneficiaryHistory beneficiary={history} onClose={() => setHistory(null)} />
      <CredentialsModal credentials={credentials} onClose={() => setCredentials(null)} />
    </div>
  );
}
