'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { BeneficiaryTable } from '@/components/admin/BeneficiaryTable';
import { ImportPanel } from '@/components/admin/ImportPanel';
import { PartnerForm } from '@/components/admin/PartnerForm';
import { RuleForm } from '@/components/admin/RuleForm';
import { Alert, Badge, Button, Card, Modal, PageHeader, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { categoryLabel, longDate, PERIOD_LABEL, percent } from '@/lib/format';
import type { Category, Partner } from '@/lib/types';
import { useApi } from '@/lib/useApi';

export default function PartnerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const partner = useApi<Partner>('admin', `/api/partners/${id}`);
  const partners = useApi<Partner[]>('admin', '/api/partners');
  const categories = useApi<Category[]>('admin', '/api/categories');
  const [editing, setEditing] = useState<'profile' | 'rule' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const p = partner.data;
  if (!p) {
    return partner.error ? <Alert>{partner.error}</Alert> : <Spinner />;
  }
  const labels = Object.fromEntries((categories.data ?? []).map((c) => [c.code, c.label]));
  const activationLink = typeof window === 'undefined' ? '' : `${window.location.origin}/connexion?p=${p.id}`;

  const toggle = async () => {
    setError(null);
    try {
      partner.setData(await api<Partner>('admin', `/api/partners/${p.id}/status`, { method: 'PATCH', body: { active: !p.active } }));
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <>
      <Link href="/admin/partenaires" className="text-sm text-muted hover:underline">
        ← Partenaires
      </Link>
      <PageHeader
        title={p.name}
        subtitle={`${p.beneficiaryCount} bénéficiaire(s) · ${p.activatedCount} compte(s) activé(s)`}
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditing('profile')}>
              Modifier
            </Button>
            <Button variant={p.active ? 'danger' : 'primary'} onClick={toggle}>
              {p.active ? 'Désactiver' : 'Activer'}
            </Button>
          </>
        }
      />
      {error && <Alert>{error}</Alert>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h2 className="font-display text-lg font-semibold">Convention</h2>
          <div className="mt-2">
            {!p.active ? <Badge tone="danger">Partenaire inactif</Badge> : p.conventionRunning ? <Badge tone="success">En cours</Badge> : <Badge tone="warning">Hors période</Badge>}
          </div>
          <p className="mt-3 text-sm">
            Du {longDate(p.conventionStart)}
            <br />
            au {longDate(p.conventionEnd)}
          </p>
          {(p.contactName || p.contactPhone || p.contactEmail) && (
            <p className="mt-3 text-sm text-muted">
              {p.contactName}
              {p.contactPhone && <><br />{p.contactPhone}</>}
              {p.contactEmail && <><br />{p.contactEmail}</>}
            </p>
          )}
        </Card>
        <Card>
          <div className="flex items-start justify-between">
            <h2 className="font-display text-lg font-semibold">Avantage</h2>
            <Button size="sm" variant="ghost" onClick={() => setEditing('rule')} disabled={!categories.data}>
              Modifier
            </Button>
          </div>
          <p className="mt-2 font-display text-3xl font-semibold text-brand-700">−{percent(p.discountPercent)}</p>
          <p className="text-sm">
            {p.usagesPerPeriod} utilisation(s) par {PERIOD_LABEL[p.usagePeriod]}
          </p>
          <p className="mt-2 text-sm text-muted">Éligibles : {p.eligibleCategories.map((c) => categoryLabel(c, labels)).join(', ')}</p>
          {p.excludedCategories.length > 0 && (
            <p className="text-sm text-muted">Exclues : {p.excludedCategories.map((c) => categoryLabel(c, labels)).join(', ')}</p>
          )}
        </Card>
        <Card>
          <h2 className="font-display text-lg font-semibold">Lien d&apos;activation</h2>
          <p className="mt-1 text-sm text-muted">À partager avec le partenaire : page de connexion à son nom.</p>
          <p className="mt-3 break-all rounded-lg bg-canvas p-2 font-mono text-xs">{activationLink}</p>
          <Button
            size="sm"
            variant="secondary"
            className="mt-3"
            onClick={async () => {
              await navigator.clipboard?.writeText(activationLink);
              setCopied(true);
            }}
          >
            {copied ? 'Copié ✓' : 'Copier le lien'}
          </Button>
        </Card>
      </div>

      <div className="mt-6">
        <ImportPanel
          partnerId={p.id}
          partnerName={p.name}
          onImported={() => {
            setRefreshKey((k) => k + 1);
            partner.reload();
          }}
        />
      </div>

      <h2 className="mb-3 mt-8 font-display text-xl font-semibold">Bénéficiaires</h2>
      <BeneficiaryTable partners={partners.data ?? [p]} partnerId={p.id} refreshKey={refreshKey} />

      <Modal open={editing === 'profile'} title="Modifier le partenaire" onClose={() => setEditing(null)}>
        <PartnerForm
          partner={p}
          onSaved={(saved) => {
            partner.setData(saved);
            setEditing(null);
          }}
        />
      </Modal>
      <Modal open={editing === 'rule'} title="Règle d'avantage" onClose={() => setEditing(null)}>
        {categories.data && (
          <RuleForm
            partner={p}
            categories={categories.data}
            onSaved={(saved) => {
              partner.setData(saved);
              setEditing(null);
            }}
          />
        )}
      </Modal>
    </>
  );
}
