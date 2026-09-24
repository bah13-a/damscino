'use client';

import { useRef, useState } from 'react';
import { api, download, errorMessage } from '@/lib/api';
import type { ImportReport } from '@/lib/types';
import { Alert, Button, Card } from '../ui';

/** Import of an Excel / CSV list with duplicate control; the generated accesses can be exported right after. */
export function ImportPanel({ partnerId, partnerName, onImported }: { partnerId: string; partnerName: string; onImported: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const body = new FormData();
      body.append('file', file);
      setReport(await api<ImportReport>('admin', `/api/partners/${partnerId}/beneficiaries/import`, { method: 'POST', body }));
      onImported();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <Card>
      <h2 className="font-display text-lg font-semibold">Importer une liste</h2>
      <p className="mt-1 text-sm text-muted">
        Fichier Excel (.xlsx) ou CSV avec les colonnes <strong>Nom</strong>, <strong>Prénom</strong>, <strong>Téléphone</strong>. Les
        doublons (dans le fichier ou déjà enregistrés) sont ignorés ; chaque nouvelle personne reçoit un identifiant (son téléphone)
        et un mot de passe temporaire.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          ref={input}
          type="file"
          accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
        <Button loading={busy} onClick={() => input.current?.click()}>
          Choisir un fichier
        </Button>
        <Button variant="secondary" onClick={() => download('admin', '/api/beneficiaries/import-template?format=xlsx', 'modele.xlsx')}>
          Télécharger le modèle
        </Button>
        <Button
          variant="secondary"
          onClick={() => download('admin', `/api/partners/${partnerId}/accesses/export?format=xlsx`, `acces-${partnerName}.xlsx`).catch((e) => setError(errorMessage(e)))}
        >
          Exporter les accès
        </Button>
      </div>
      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}
      {report && (
        <div className="mt-4 space-y-3">
          <Alert tone="success">
            {report.created.length} bénéficiaire(s) créé(s) sur {report.totalRows} ligne(s). Utilisez « Exporter les accès » pour
            transmettre les identifiants au partenaire.
          </Alert>
          {report.skipped.length > 0 && (
            <div className="rounded-xl border border-line">
              <p className="border-b border-line px-3 py-2 text-sm font-semibold">{report.skipped.length} ligne(s) ignorée(s)</p>
              <ul className="max-h-60 divide-y divide-line overflow-y-auto text-sm">
                {report.skipped.map((s) => (
                  <li key={s.line} className="flex justify-between gap-3 px-3 py-2">
                    <span>
                      Ligne {s.line} · {s.lastName} {s.firstName} {s.phone && `(${s.phone})`}
                    </span>
                    <span className="text-right text-red-700">{s.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
