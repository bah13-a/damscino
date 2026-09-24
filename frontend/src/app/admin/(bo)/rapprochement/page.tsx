'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert, Badge, Button, Card, Empty, Field, PageHeader, Select, Table } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { dateTime, dt, shortDate } from '@/lib/format';
import type { ColumnMapping, ReconciliationReport, SalesInspection, TillSettings } from '@/lib/types';
import { query } from '@/lib/useApi';

const FIELDS: { key: keyof ColumnMapping; label: string; hint?: string; required?: boolean }[] = [
  { key: 'dateTime', label: 'Date et heure', hint: 'Ou bien « Date » + « Heure » ci-dessous' },
  { key: 'date', label: 'Date' },
  { key: 'time', label: 'Heure' },
  { key: 'amount', label: 'Montant de la remise', required: true },
  { key: 'label', label: 'Libellé de la remise', hint: 'Pour ne garder que les remises Damascino' },
  { key: 'code', label: 'Commentaire / référence', hint: 'Où le caissier note le code de validation' },
  { key: 'ticket', label: 'N° de ticket' },
  { key: 'cashier', label: 'Caissier' },
];

const MATCHED_BY: Record<string, string> = { CODE: 'Code de validation', TICKET: 'N° de ticket', TIME_AND_AMOUNT: 'Heure et montant' };

function toCsv(report: ReconciliationReport): string {
  const rows: (string | number | null)[][] = [['Anomalie', 'Date et heure', 'Ticket', 'Bénéficiaire', 'Validé par', 'Remise caisse (DT)', 'Remise validée (DT)', 'Code']];
  report.discountsWithoutPassage.forEach((s) =>
    rows.push(['Remise en caisse sans passage validé', dateTime(s.dateTime), s.ticket, '', s.cashier, s.amount, '', s.code]),
  );
  report.passagesWithoutDiscount.forEach((p) =>
    rows.push(['Passage validé sans remise en caisse', dateTime(p.dateTime), p.ticketId, p.beneficiaryName, p.staffName, '', p.discountAmount, p.validationCode]),
  );
  report.matched
    .filter((m) => m.amountGap !== null && Math.abs(m.amountGap) >= 0.01)
    .forEach((m) =>
      rows.push(['Écart de montant', dateTime(m.sale.dateTime), m.sale.ticket, m.passage.beneficiaryName, m.passage.staffName, m.sale.amount, m.passage.discountAmount, m.passage.validationCode]),
    );
  return '﻿' + rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
}

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: 'danger' | 'warning' | 'success' }) {
  const color = tone === 'danger' ? 'text-red-700' : tone === 'warning' ? 'text-amber-700' : tone === 'success' ? 'text-emerald-700' : 'text-ink';
  return (
    <Card className="!p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${color}`}>{value}</p>
    </Card>
  );
}

export default function ReconciliationPage() {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<SalesInspection | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [discountLabel, setDiscountLabel] = useState('Damascino');
  const [tolerance, setTolerance] = useState('30');
  const [report, setReport] = useState<ReconciliationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<TillSettings>('admin', '/api/privileges/settings').then((s) => setDiscountLabel(s.discountLabel)).catch(() => undefined);
  }, []);

  const inspect = async (selected: File) => {
    setFile(selected);
    setReport(null);
    setError(null);
    setBusy(true);
    try {
      const body = new FormData();
      body.append('file', selected);
      const result = await api<SalesInspection>('admin', '/api/reporting/reconciliation/inspect', { method: 'POST', body });
      setInspection(result);
      setMapping(result.guessedMapping);
    } catch (e) {
      setInspection(null);
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const run = async () => {
    if (!file || !mapping) return;
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const params = query({ ...mapping, discountLabel, toleranceMinutes: tolerance });
      setReport(await api<ReconciliationReport>('admin', `/api/reporting/reconciliation${params}`, { method: 'POST', body }));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([toCsv(report)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `rapprochement-${report.from}_${report.to}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const gaps = report?.matched.filter((m) => m.amountGap !== null && Math.abs(m.amountGap) >= 0.01) ?? [];

  return (
    <>
      <PageHeader
        title="Rapprochement avec la caisse"
        subtitle="Comparez les remises saisies dans la caisse (export des ventes) avec les passages validés sur la plateforme : remises sans QR validé, oublis et écarts de montant."
      />
      {error && <Alert>{error}</Alert>}

      <Card>
        <h2 className="font-display text-lg font-bold">1. Export des ventes de la caisse</h2>
        <p className="mt-1 text-sm text-muted">
          Fichier Excel ou CSV exporté depuis la caisse (une ligne par ticket ou par remise), sur un ou plusieurs jours.
        </p>
        <input
          ref={input}
          type="file"
          accept=".xlsx,.xls,.csv,.txt"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && inspect(e.target.files[0])}
        />
        <div className="mt-3 flex items-center gap-3">
          <Button loading={busy && !inspection} onClick={() => input.current?.click()}>
            Choisir l&apos;export
          </Button>
          {file && inspection && (
            <span className="text-sm text-muted">
              {file.name} · {inspection.rowCount} ligne(s)
            </span>
          )}
        </div>
      </Card>

      {inspection && mapping && (
        <Card className="mt-4">
          <h2 className="font-display text-lg font-bold">2. Colonnes de l&apos;export</h2>
          <p className="mt-1 text-sm text-muted">Colonnes reconnues automatiquement : vérifiez-les avant de lancer la comparaison.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FIELDS.map((field) => (
              <div key={field.key}>
                <Select
                  label={`${field.label}${field.required ? ' *' : ''}`}
                  value={mapping[field.key] ?? ''}
                  onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value === '' ? null : Number(e.target.value) })}
                >
                  <option value="">—</option>
                  {inspection.headers.map((header, index) => (
                    <option key={index} value={index}>
                      {header || `Colonne ${index + 1}`}
                    </option>
                  ))}
                </Select>
                {field.hint && <p className="mt-1 text-xs text-muted">{field.hint}</p>}
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label="Nom de la remise Damascino"
              value={discountLabel}
              onChange={(e) => setDiscountLabel(e.target.value)}
              hint="Les autres remises de la caisse sont ignorées"
            />
            <Field label="Tolérance horaire (minutes)" type="number" min={1} max={240} value={tolerance} onChange={(e) => setTolerance(e.target.value)} />
          </div>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-muted">Aperçu des premières lignes</summary>
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr>
                    {inspection.headers.map((h, i) => (
                      <th key={i} className="border-b border-line px-2 py-1 text-left">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inspection.sample.map((row, r) => (
                    <tr key={r}>
                      {row.map((cell, c) => (
                        <td key={c} className="border-b border-line px-2 py-1">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <Button className="mt-4" loading={busy} onClick={run}>
            3. Lancer le rapprochement
          </Button>
        </Card>
      )}

      {report && (
        <div className="mt-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold">
              Résultat du {shortDate(report.from)} au {shortDate(report.to)}
            </h2>
            <Button variant="secondary" onClick={exportCsv}>
              Exporter les anomalies (CSV)
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Remises en caisse" value={`${report.discountRows} · ${dt(report.tillDiscountTotal)}`} />
            <Kpi label="Passages validés" value={`${report.passages} · ${dt(report.platformDiscountTotal)}`} />
            <Kpi label="Rapprochés" value={report.matched.length} tone="success" />
            <Kpi label="Écarts de montant" value={report.amountGaps} tone={report.amountGaps ? 'warning' : undefined} />
            <Kpi label="Remises sans passage" value={report.discountsWithoutPassage.length} tone={report.discountsWithoutPassage.length ? 'danger' : undefined} />
            <Kpi label="Passages sans remise" value={report.passagesWithoutDiscount.length} tone={report.passagesWithoutDiscount.length ? 'warning' : undefined} />
            <Kpi label="Lignes illisibles" value={report.rejectedRows.length} tone={report.rejectedRows.length ? 'warning' : undefined} />
          </div>

          <section>
            <h3 className="mb-1 font-display text-lg font-bold text-red-700">Remises en caisse sans passage validé</h3>
            <p className="mb-3 text-sm text-muted">Remise « {discountLabel} » saisie sans QR code validé sur la plateforme : à vérifier avec le caissier.</p>
            {report.discountsWithoutPassage.length === 0 ? (
              <Empty>Aucune.</Empty>
            ) : (
              <Table head={['Ligne', 'Date et heure', 'Ticket', 'Caissier', 'Remise', 'Commentaire']}>
                {report.discountsWithoutPassage.map((s) => (
                  <tr key={s.line}>
                    <td className="px-4 py-3 text-muted">{s.line}</td>
                    <td className="px-4 py-3">{dateTime(s.dateTime)}</td>
                    <td className="px-4 py-3">{s.ticket ?? '—'}</td>
                    <td className="px-4 py-3">{s.cashier ?? '—'}</td>
                    <td className="px-4 py-3 font-semibold">{dt(s.amount)}</td>
                    <td className="px-4 py-3 text-muted">{s.code ?? '—'}</td>
                  </tr>
                ))}
              </Table>
            )}
          </section>

          <section>
            <h3 className="mb-1 font-display text-lg font-bold text-amber-700">Passages validés sans remise en caisse</h3>
            <p className="mb-3 text-sm text-muted">QR code validé sur la tablette mais aucune remise correspondante dans la caisse (oubli, ou remise saisie sous un autre nom).</p>
            {report.passagesWithoutDiscount.length === 0 ? (
              <Empty>Aucun.</Empty>
            ) : (
              <Table head={['Date et heure', 'Bénéficiaire', 'Partenaire', 'Validé par', 'Remise validée', 'Code']}>
                {report.passagesWithoutDiscount.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3">{dateTime(p.dateTime)}</td>
                    <td className="px-4 py-3 font-medium">{p.beneficiaryName}</td>
                    <td className="px-4 py-3">{p.partnerName}</td>
                    <td className="px-4 py-3">{p.staffName}</td>
                    <td className="px-4 py-3">{dt(p.discountAmount)}</td>
                    <td className="px-4 py-3 font-mono">{p.validationCode ?? '—'}</td>
                  </tr>
                ))}
              </Table>
            )}
          </section>

          {gaps.length > 0 && (
            <section>
              <h3 className="mb-3 font-display text-lg font-bold text-amber-700">Écarts de montant</h3>
              <Table head={['Date et heure', 'Ticket', 'Bénéficiaire', 'Remise caisse', 'Remise validée', 'Écart']}>
                {gaps.map((m) => (
                  <tr key={m.passage.id}>
                    <td className="px-4 py-3">{dateTime(m.sale.dateTime)}</td>
                    <td className="px-4 py-3">{m.sale.ticket ?? '—'}</td>
                    <td className="px-4 py-3 font-medium">{m.passage.beneficiaryName}</td>
                    <td className="px-4 py-3">{dt(m.sale.amount)}</td>
                    <td className="px-4 py-3">{dt(m.passage.discountAmount)}</td>
                    <td className="px-4 py-3 font-semibold text-amber-700">{m.amountGap! > 0 ? '+' : '−'}{dt(Math.abs(m.amountGap!))}</td>
                  </tr>
                ))}
              </Table>
            </section>
          )}

          <details>
            <summary className="cursor-pointer font-display text-lg font-bold">Rapprochés ({report.matched.length})</summary>
            <div className="mt-3">
              <Table head={['Date et heure', 'Ticket', 'Bénéficiaire', 'Remise caisse', 'Rapproché par']}>
                {report.matched.map((m) => (
                  <tr key={m.passage.id}>
                    <td className="px-4 py-3">{dateTime(m.sale.dateTime)}</td>
                    <td className="px-4 py-3">{m.sale.ticket ?? '—'}</td>
                    <td className="px-4 py-3">{m.passage.beneficiaryName}</td>
                    <td className="px-4 py-3">{dt(m.sale.amount)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={m.matchedBy === 'TIME_AND_AMOUNT' ? 'neutral' : 'success'}>{MATCHED_BY[m.matchedBy]}</Badge>
                    </td>
                  </tr>
                ))}
              </Table>
            </div>
          </details>

          {report.rejectedRows.length > 0 && (
            <details>
              <summary className="cursor-pointer font-display text-lg font-bold">Lignes illisibles ({report.rejectedRows.length})</summary>
              <ul className="mt-2 space-y-1 text-sm text-muted">
                {report.rejectedRows.slice(0, 100).map((r) => (
                  <li key={r.line}>
                    Ligne {r.line} : {r.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </>
  );
}
