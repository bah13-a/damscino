'use client';

import { BeneficiaryTable } from '@/components/admin/BeneficiaryTable';
import { Alert, PageHeader } from '@/components/ui';
import type { Partner } from '@/lib/types';
import { useApi } from '@/lib/useApi';

export default function BeneficiariesPage() {
  const partners = useApi<Partner[]>('admin', '/api/partners');
  return (
    <>
      <PageHeader title="Bénéficiaires" subtitle="Recherche par nom ou téléphone, accès, activation et historique." />
      {partners.error && <Alert>{partners.error}</Alert>}
      {partners.data && <BeneficiaryTable partners={partners.data} />}
    </>
  );
}
