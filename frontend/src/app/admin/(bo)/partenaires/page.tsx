'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PartnerForm } from '@/components/admin/PartnerForm';
import { ExportButtons } from '@/components/ExportButtons';
import { Alert, Badge, Button, Empty, Modal, PageHeader, Table } from '@/components/ui';
import { categoryLabel, PERIOD_LABEL, percent, shortDate } from '@/lib/format';
import type { Partner } from '@/lib/types';
import { useApi } from '@/lib/useApi';

export default function PartnersPage() {
  const router = useRouter();
  const partners = useApi<Partner[]>('admin', '/api/partners');
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        title="Partenaires"
        subtitle="Entreprises et groupes dont les collaborateurs bénéficient de l'avantage."
        actions={
          <>
            <ExportButtons path="/api/partners/export" name="partenaires" />
            <Button onClick={() => setCreating(true)}>Nouveau partenaire</Button>
          </>
        }
      />
      {partners.error && <Alert>{partners.error}</Alert>}
      {partners.data && partners.data.length === 0 && <Empty>Aucun partenaire. Créez le premier pour importer sa liste de bénéficiaires.</Empty>}
      {partners.data && partners.data.length > 0 && (
        <Table head={['Partenaire', 'Statut', 'Convention', 'Avantage', 'Bénéficiaires', 'Activés']}>
          {partners.data.map((p) => (
            <tr key={p.id} className="cursor-pointer hover:bg-canvas" onClick={() => router.push(`/admin/partenaires/${p.id}`)}>
              <td className="px-4 py-3 font-medium">
                <Link href={`/admin/partenaires/${p.id}`} className="hover:underline">
                  {p.name}
                </Link>
              </td>
              <td className="px-4 py-3">
                {!p.active ? <Badge tone="danger">Inactif</Badge> : p.conventionRunning ? <Badge tone="success">En cours</Badge> : <Badge tone="warning">Hors convention</Badge>}
              </td>
              <td className="px-4 py-3 text-muted">
                {shortDate(p.conventionStart)} → {shortDate(p.conventionEnd)}
              </td>
              <td className="px-4 py-3">
                −{percent(p.discountPercent)} · {p.usagesPerPeriod}/{PERIOD_LABEL[p.usagePeriod]}
                <div className="text-xs text-muted">{p.eligibleCategories.map((c) => categoryLabel(c)).join(', ')}</div>
              </td>
              <td className="px-4 py-3 tabular-nums">{p.beneficiaryCount}</td>
              <td className="px-4 py-3 tabular-nums">{p.activatedCount}</td>
            </tr>
          ))}
        </Table>
      )}
      <Modal open={creating} title="Nouveau partenaire" onClose={() => setCreating(false)}>
        <PartnerForm onSaved={(p) => router.push(`/admin/partenaires/${p.id}`)} />
      </Modal>
    </>
  );
}
