'use client';

import { dateTime, dt, percent } from '@/lib/format';
import type { Beneficiary, Page, UsageRow } from '@/lib/types';
import { query, useApi } from '@/lib/useApi';
import { Empty, Modal, Spinner } from '../ui';

export function BeneficiaryHistory({ beneficiary, onClose }: { beneficiary: Beneficiary | null; onClose: () => void }) {
  const usages = useApi<Page<UsageRow>>(
    'admin',
    beneficiary ? `/api/reporting/usages${query({ beneficiaryId: beneficiary.id, size: 100 })}` : null,
  );
  if (!beneficiary) return null;
  return (
    <Modal open title={`Historique · ${beneficiary.firstName} ${beneficiary.lastName}`} onClose={onClose}>
      {!usages.data && <Spinner />}
      {usages.data && usages.data.items.length === 0 && <Empty>Aucun passage.</Empty>}
      {usages.data && usages.data.items.length > 0 && (
        <ul className="divide-y divide-line text-sm">
          {usages.data.items.map((u) => (
            <li key={u.id} className="flex justify-between gap-3 py-2">
              <span>
                {dateTime(u.validatedAt)}
                <span className="block text-xs text-muted">validé par {u.staffName}</span>
              </span>
              <span className="text-right">
                −{percent(u.discountPercent)}
                <span className="block text-xs text-muted">{dt(u.discountAmount)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
