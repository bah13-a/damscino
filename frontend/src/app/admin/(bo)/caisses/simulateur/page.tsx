'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { QrScanner } from '@/components/QrScanner';
import { Alert, Badge, Button, Card, Field, PageHeader } from '@/components/ui';
import { dt } from '@/lib/format';

/**
 * Till simulator: calls the till API (/api/pos/v1) exactly as a connected till would, with its API key. Used for
 * acceptance tests and by the till vendor to understand the expected exchanges.
 */

interface Line {
  lineId: string;
  sku: string;
  label: string;
  category: string;
  unitPrice: string;
  quantity: string;
}

interface Exchange {
  endpoint: string;
  request: unknown;
  status: number;
  response: unknown;
}

interface Preview {
  status: string;
  reason: string | null;
  message: string;
  reservationId: string | null;
  reservedUntil: string | null;
  beneficiary: { name: string; partner: string } | null;
  discount: { lineId: string; label: string; amount: number; percent: number } | null;
  totalBefore: number;
  totalAfter: number;
}

const SAMPLE: Line[] = [
  { lineId: '1', sku: 'EAU-50', label: 'Eau 0,5 L', category: 'BOISSONS', unitPrice: '4', quantity: '1' },
  { lineId: '2', sku: 'KEB-AZM', label: 'Azmari Kebab', category: 'PLATS', unitPrice: '40', quantity: '1' },
  { lineId: '3', sku: 'DES-KUN', label: 'Kunafa', category: 'DESSERTS', unitPrice: '15', quantity: '1' },
];

const newTicketId = () => `T-${new Date().toISOString().replace(/\D/g, '').slice(2, 14)}`;

function readKey(): string {
  try {
    return sessionStorage.getItem('dp.pos.simulator.key') ?? '';
  } catch {
    return '';
  }
}

export default function TillSimulatorPage() {
  const [apiKey, setApiKey] = useState('');
  const [ticketId, setTicketId] = useState(newTicketId);
  const [cashier, setCashier] = useState('Sami');
  const [lines, setLines] = useState<Line[]>(SAMPLE);
  const [code, setCode] = useState('');
  const [camera, setCamera] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [outcome, setOutcome] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(null);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => setApiKey(readKey()), []);
  useEffect(() => {
    try {
      sessionStorage.setItem('dp.pos.simulator.key', apiKey);
    } catch {
      // ignore
    }
  }, [apiKey]);

  const call = async <T,>(method: 'GET' | 'POST', endpoint: string, body?: unknown): Promise<{ status: number; data: T }> => {
    setBusy(true);
    try {
      const response = await fetch(`/api/pos/v1/${endpoint}`, {
        method,
        headers: { 'X-Api-Key': apiKey.trim(), ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await response.json().catch(() => ({}))) as T;
      setExchanges((list) => [{ endpoint: `${method} /api/pos/v1/${endpoint}`, request: body ?? null, status: response.status, response: data }, ...list].slice(0, 8));
      return { status: response.status, data };
    } finally {
      setBusy(false);
    }
  };

  const ticketBody = () => ({
    code: code.trim(),
    ticketId,
    cashier,
    lines: lines.map((l) => ({
      lineId: l.lineId,
      sku: l.sku || null,
      label: l.label,
      category: l.category || null,
      unitPrice: Number(l.unitPrice.replace(',', '.')),
      quantity: Number(l.quantity.replace(',', '.')) || 1,
    })),
  });

  const doPreview = async (token = code) => {
    setOutcome(null);
    const { status, data } = await call<Preview>('POST', 'preview', { ...ticketBody(), code: token.trim() });
    if (status === 401) return setOutcome({ tone: 'danger', text: "Clé d'API invalide ou révoquée." });
    if (status >= 400) return setOutcome({ tone: 'danger', text: (data as unknown as { message?: string }).message ?? `Erreur ${status}` });
    setPreview(data);
  };

  const doConfirm = async () => {
    if (!preview?.reservationId) return;
    const { data } = await call<{ status: string; message: string; validationCode: string | null }>('POST', 'confirm', {
      reservationId: preview.reservationId,
      ticketId,
      paidAt: new Date().toISOString(),
    });
    setOutcome(
      data.status === 'CONFIRMED'
        ? { tone: 'success', text: `Ticket payé : passage enregistré (code ${data.validationCode}).` }
        : { tone: 'danger', text: data.message },
    );
  };

  const doCancel = async () => {
    const { data } = await call<{ status: string }>('POST', 'cancel', { ticketId, reason: 'Ticket annulé (simulateur)' });
    setOutcome({ tone: 'info', text: data.status === 'CANCELLED' ? "Ticket annulé : l'avantage est de nouveau disponible." : 'Rien à annuler sur ce ticket.' });
    setPreview(null);
  };

  const reset = () => {
    setTicketId(newTicketId());
    setCode('');
    setPreview(null);
    setOutcome(null);
    setLines(SAMPLE);
  };

  const setLine = (index: number, key: keyof Line, value: string) =>
    setLines(lines.map((l, i) => (i === index ? { ...l, [key]: value } : l)));

  const valid = preview?.status === 'VALID';

  return (
    <>
      <Link href="/admin/caisses" className="text-sm text-muted hover:underline">
        ← Intégration caisse
      </Link>
      <PageHeader
        title="Simulateur de caisse"
        subtitle="Reproduit les appels qu'un logiciel de caisse fait à l'API (aperçu → paiement → annulation). Aucun appel n'utilise votre session admin : seule la clé de la caisse compte."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Field label="Clé d'API de la caisse" className="flex-1" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="dpk_…" autoComplete="off" />
              <Button
                variant="secondary"
                disabled={!apiKey}
                onClick={async () => {
                  const { status, data } = await call<{ terminal: string }>('GET', 'ping');
                  setOutcome(status === 200 ? { tone: 'success', text: `Connecté en tant que « ${data.terminal} ».` } : { tone: 'danger', text: "Clé d'API invalide ou révoquée." });
                }}
              >
                Tester la connexion
              </Button>
            </div>
          </Card>

          <Card>
            <div className="mb-3 grid gap-3 sm:grid-cols-2">
              <Field label="N° de ticket" value={ticketId} onChange={(e) => setTicketId(e.target.value)} />
              <Field label="Caissier" value={cashier} onChange={(e) => setCashier(e.target.value)} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="text-left text-xs uppercase text-muted">
                  <tr>
                    <th className="py-1 pr-2">Libellé</th>
                    <th className="py-1 pr-2">Référence</th>
                    <th className="py-1 pr-2">Catégorie</th>
                    <th className="py-1 pr-2">Prix (DT)</th>
                    <th className="py-1 pr-2">Qté</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => {
                    const discounted = valid && preview?.discount?.lineId === line.lineId;
                    return (
                      <tr key={line.lineId} className={discounted ? 'bg-emerald-50 dark:bg-emerald-900/30' : ''}>
                        {(['label', 'sku', 'category', 'unitPrice', 'quantity'] as const).map((key) => (
                          <td key={key} className="py-1 pr-2">
                            <input
                              aria-label={`${key} ligne ${index + 1}`}
                              value={line[key]}
                              onChange={(e) => setLine(index, key, e.target.value)}
                              className="w-full rounded-lg border border-line bg-surface px-2 py-1.5"
                            />
                          </td>
                        ))}
                        <td className="py-1">
                          <button className="text-muted" aria-label="Supprimer la ligne" onClick={() => setLines(lines.filter((_, i) => i !== index))}>
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="mt-2"
              onClick={() => setLines([...lines, { lineId: String(Date.now()), sku: '', label: '', category: 'PLATS', unitPrice: '', quantity: '1' }])}
            >
              + Ajouter une ligne
            </Button>
          </Card>

          <Card>
            <div className="flex flex-col gap-3">
              <label className="text-sm font-medium" htmlFor="qr-code">
                QR code du client
              </label>
              <textarea
                id="qr-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                rows={2}
                placeholder="Scannez le QR (douchette) ou collez le code DP1…"
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 font-mono text-xs"
              />
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setCamera(!camera)}>
                  {camera ? 'Fermer la caméra' : 'Scanner avec la caméra'}
                </Button>
                <Button loading={busy} disabled={!apiKey || !code.trim()} onClick={() => doPreview()}>
                  1. Aperçu de la remise
                </Button>
                <Button variant="primary" disabled={busy || !valid} onClick={doConfirm}>
                  2. Encaisser le ticket
                </Button>
                <Button variant="danger" disabled={busy || !apiKey} onClick={doCancel}>
                  Annuler le ticket
                </Button>
                <Button variant="ghost" onClick={reset}>
                  Nouveau ticket
                </Button>
              </div>
              {camera && (
                <QrScanner
                  active={camera}
                  onScan={(text) => {
                    setCamera(false);
                    setCode(text);
                    doPreview(text);
                  }}
                />
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          {outcome && <Alert tone={outcome.tone}>{outcome.text}</Alert>}
          {preview && (
            <Card className={valid ? 'border-emerald-500' : 'border-red-500'}>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold">Ticket {ticketId}</h2>
                {valid ? <Badge tone="success">Avantage valide</Badge> : <Badge tone="danger">Refusé</Badge>}
              </div>
              {preview.beneficiary && (
                <p className="mt-2 text-sm">
                  <strong>{preview.beneficiary.name}</strong> · {preview.beneficiary.partner}
                </p>
              )}
              {!valid && <p className="mt-2 text-red-700">{preview.message}</p>}
              <dl className="mt-4 space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{dt(preview.totalBefore)}</dd>
                </div>
                {valid && preview.discount && (
                  <div className="flex justify-between text-emerald-700">
                    <dt>
                      Damascino Privilèges −{preview.discount.percent} % · {preview.discount.label}
                    </dt>
                    <dd className="tabular-nums">−{dt(preview.discount.amount)}</dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-line pt-2 text-base font-bold">
                  <dt>À payer</dt>
                  <dd className="tabular-nums">{dt(preview.totalAfter)}</dd>
                </div>
              </dl>
            </Card>
          )}
          <Card>
            <h2 className="font-display text-lg font-semibold">Échanges avec l&apos;API</h2>
            {exchanges.length === 0 && <p className="mt-2 text-sm text-muted">Les requêtes et réponses apparaîtront ici.</p>}
            <ol className="mt-3 space-y-3">
              {exchanges.map((exchange, index) => (
                <li key={index} className="rounded-xl border border-line p-3 text-xs">
                  <p className="font-mono font-semibold">
                    {exchange.endpoint} → {exchange.status}
                  </p>
                  {exchange.request !== null && (
                    <pre className="mt-2 max-h-40 overflow-auto rounded bg-canvas p-2">{JSON.stringify(exchange.request, null, 2)}</pre>
                  )}
                  <pre className="mt-2 max-h-48 overflow-auto rounded bg-canvas p-2">{JSON.stringify(exchange.response, null, 2)}</pre>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
