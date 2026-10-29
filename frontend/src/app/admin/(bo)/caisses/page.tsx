'use client';

import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { Alert, Badge, Button, Card, Field, Modal, PageHeader, Select, Table } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { categoryLabel, dateTime } from '@/lib/format';
import type { ApplyMode, Category, PosProduct, PosTerminal, PosTerminalWithKey, TillSettings } from '@/lib/types';
import { useApi } from '@/lib/useApi';

/** One of the addresses of the modal, with its copy button. */
function Copyable({ label, value, testId, copied, onCopy }: { label: string; value: string; testId: string; copied: boolean; onCopy: () => void }) {
  return (
    <>
      <p className="mt-2 break-all rounded-xl bg-canvas p-3 font-mono text-xs" data-testid={testId}>
        {value}
      </p>
      <Button
        className="mt-2"
        size="sm"
        variant="secondary"
        onClick={async () => {
          await navigator.clipboard?.writeText(value);
          onCopy();
        }}
      >
        {copied ? 'Copié ✓' : label}
      </Button>
    </>
  );
}

/**
 * After creating a till: points to its counter QR code (all a till without phone nor PC needs), and shows once the
 * optional addresses that carry its API key (network scanner, scanner station page, till vendor).
 */
function KeyModal({ created, onClose }: { created: PosTerminalWithKey | null; onClose: () => void }) {
  const [copied, setCopied] = useState<'scanner' | 'station' | 'key' | null>(null);
  if (!created) return null;
  const key = encodeURIComponent(created.apiKey);
  const scannerUrl = `${window.location.origin}/api/pos/v1/douchette/${key}`;
  const stationLink = `${window.location.origin}/douchette#cle=${key}`;
  return (
    <Modal open title={`Caisse ajoutée · ${created.terminal.name}`} onClose={onClose}>
      <Alert tone="success">
        Imprimez maintenant son <strong>QR de caisse</strong> (bouton « QR de caisse » dans la liste) et collez-le sur le
        comptoir : c&apos;est tout ce qu&apos;il faut pour que les clients utilisent leur avantage.
      </Alert>
      <h3 className="mt-5 font-semibold">Optionnel : douchette ou logiciel de caisse</h3>

      <h4 className="mt-3 font-semibold">Douchette réseau (Wi-Fi ou Ethernet)</h4>
      <p className="text-sm text-muted">
        Adresse d&apos;envoi à saisir une fois dans la douchette (réglage « HTTP » / « URL du serveur »). Chaque QR code lu
        est validé et le résultat s&apos;affiche sur le téléphone du client. La colonne « Dernier appel » confirme que la
        douchette est bien reliée.
      </p>
      <Copyable label="Copier l'adresse" value={scannerUrl} testId="scanner-url" copied={copied === 'scanner'} onCopy={() => setCopied('scanner')} />

      <details className="mt-5 text-sm">
        <summary className="cursor-pointer font-semibold">Autres branchements</summary>
        <h4 className="mt-3 font-semibold">Douchette USB sur un PC ou une tablette</h4>
        <p className="text-muted">Lien à ouvrir une fois dans le navigateur de l&apos;appareil où la douchette est branchée.</p>
        <Copyable label="Copier le lien" value={stationLink} testId="station-link" copied={copied === 'station'} onCopy={() => setCopied('station')} />
        <h4 className="mt-4 font-semibold">Clé d&apos;API (éditeur du logiciel de caisse)</h4>
        <Copyable label="Copier la clé" value={created.apiKey} testId="api-key" copied={copied === 'key'} onCopy={() => setCopied('key')} />
      </details>
      <p className="mt-3 text-xs text-muted">
        Ces adresses ne seront plus affichées. En cas de perte, « Nouvelle clé » en donne de nouvelles et les anciennes cessent
        aussitôt de fonctionner.
      </p>

      <div className="mt-6 flex justify-end">
        <Button onClick={onClose}>Fermer</Button>
      </div>
    </Modal>
  );
}

function Terminals() {
  const terminals = useApi<PosTerminal[]>('admin', '/api/pos-terminals');
  const [name, setName] = useState('');
  const [created, setCreated] = useState<PosTerminalWithKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      await terminals.reload();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const create = (event: FormEvent) => {
    event.preventDefault();
    run(async () => {
      setCreated(await api<PosTerminalWithKey>('admin', '/api/pos-terminals', { method: 'POST', body: { name } }));
      setName('');
    });
  };

  return (
    <section>
      <h2 className="mb-1 font-display text-xl font-semibold">Caisses</h2>
      <p className="mb-4 text-sm text-muted">
        Ajoutez une caisse, puis imprimez son <strong>QR de caisse</strong> et collez-le sur le comptoir : le client le
        scanne avec l&apos;application et montre l&apos;écran « Remise validée » au caissier, sans téléphone ni douchette
        à la caisse. « Nouveau QR » remplace une étiquette abîmée ou photographiée ; « Révoquer » désactive la caisse.
      </p>
      {(error || terminals.error) && <Alert>{error ?? terminals.error}</Alert>}
      <form onSubmit={create} className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <Field label="Nom de la caisse" placeholder="ex. Caisse 1 – Salle" value={name} onChange={(e) => setName(e.target.value)} required className="flex-1" />
        <Button type="submit">Ajouter la caisse</Button>
      </form>
      {terminals.data && terminals.data.length > 0 && (
        <Table head={['Caisse', 'Clé', 'Statut', 'Dernier appel (dernier scan)', '']}>
          {terminals.data.map((t) => (
            <tr key={t.id} className={t.active ? '' : 'opacity-60'}>
              <td className="px-4 py-3 font-medium">{t.name}</td>
              <td className="px-4 py-3 font-mono text-xs">{t.keyPrefix}…</td>
              <td className="px-4 py-3">{t.active ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Révoquée</Badge>}</td>
              <td className="px-4 py-3 text-muted">{dateTime(t.lastUsedAt)}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap justify-end gap-1">
                  <Link
                    href={`/admin/etiquette?caisse=${t.id}`}
                    className="rounded-xl bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-800"
                  >
                    QR de caisse
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      confirm(`Nouveau QR code de caisse pour ${t.name} ? L'étiquette imprimée cessera de fonctionner : imprimez la nouvelle.`) &&
                      run(() => api('admin', `/api/pos-terminals/${t.id}/counter-code`, { method: 'POST' }))
                    }
                  >
                    Nouveau QR
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      confirm(`Régénérer la clé de ${t.name} ? L'ancienne clé cessera de fonctionner.`) &&
                      run(async () => setCreated(await api<PosTerminalWithKey>('admin', `/api/pos-terminals/${t.id}/rotate-key`, { method: 'POST' })))
                    }
                  >
                    Nouvelle clé
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => run(() => api('admin', `/api/pos-terminals/${t.id}/status`, { method: 'PATCH', body: { active: !t.active } }))}
                  >
                    {t.active ? 'Révoquer' : 'Réactiver'}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}
      <KeyModal created={created} onClose={() => setCreated(null)} />
    </section>
  );
}

/** "référence;libellé;catégorie" lines (header optional), ';' or ',' separated. */
function parseProducts(text: string, categories: Category[]) {
  const byLabel = new Map(categories.flatMap((c) => [[c.code.toUpperCase(), c.code], [c.label.toUpperCase(), c.code]]));
  const rows = text.replace(/^﻿/, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const products: { sku: string; label: string; category: string }[] = [];
  const errors: string[] = [];
  rows.forEach((row, index) => {
    const cells = row.split(row.includes(';') ? ';' : ',').map((c) => c.trim().replace(/^"|"$/g, ''));
    if (index === 0 && /r[ée]f|sku/i.test(cells[0])) return;
    const category = byLabel.get((cells[2] ?? '').toUpperCase());
    if (!cells[0] || !category) {
      errors.push(`Ligne ${index + 1} : référence ou catégorie inconnue (${row})`);
      return;
    }
    products.push({ sku: cells[0], label: cells[1] ?? '', category });
  });
  return { products, errors };
}

function Products() {
  const products = useApi<PosProduct[]>('admin', '/api/pos-products');
  const categories = useApi<Category[]>('admin', '/api/categories');
  const [form, setForm] = useState({ sku: '', label: '', category: '' });
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const labels = Object.fromEntries((categories.data ?? []).map((c) => [c.code, c.label]));

  const save = async (items: { sku: string; label: string; category: string }[]) => {
    setError(null);
    setInfo(null);
    try {
      const result = await api<{ saved: number }>('admin', '/api/pos-products', { method: 'PUT', body: items });
      setInfo(`${result.saved} article(s) enregistré(s).`);
      await products.reload();
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    }
  };

  const importFile = async (f: File) => {
    const { products: items, errors } = parseProducts(await f.text(), categories.data ?? []);
    if (items.length) await save(items);
    // after saving, which clears the previous messages: rejected lines must stay visible
    if (errors.length) setError(errors.slice(0, 5).join(' · '));
    if (file.current) file.current.value = '';
  };

  return (
    <section>
      <h2 className="mb-1 font-display text-xl font-semibold">Articles de la caisse</h2>
      <p className="mb-4 text-sm text-muted">
        Si la caisse n&apos;envoie pas la catégorie de chaque ligne, cette table indique à quelle catégorie Damascino correspond
        chaque référence d&apos;article (ex. <code className="font-mono">KEB-AZM</code> → Plats). Import CSV :{' '}
        <code className="font-mono">référence;libellé;catégorie</code>.
      </p>
      {error && <Alert>{error}</Alert>}
      {info && <Alert tone="success">{info}</Alert>}
      <Card className="my-4">
        <form
          className="grid gap-3 sm:grid-cols-4 sm:items-end"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await save([form])) setForm({ sku: '', label: '', category: form.category });
          }}
        >
          <Field label="Référence (SKU)" required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          <Field label="Libellé" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <Select label="Catégorie" required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="">Choisir…</option>
            {(categories.data ?? []).map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Button type="submit">Enregistrer</Button>
            <input ref={file} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
            <Button type="button" variant="secondary" onClick={() => file.current?.click()}>
              Importer CSV
            </Button>
          </div>
        </form>
      </Card>
      {products.data && products.data.length > 0 && (
        <Table head={['Référence', 'Libellé', 'Catégorie', '']}>
          {products.data.map((p) => (
            <tr key={p.sku}>
              <td className="px-4 py-3 font-mono">{p.sku}</td>
              <td className="px-4 py-3">{p.label}</td>
              <td className="px-4 py-3">{categoryLabel(p.category, labels)}</td>
              <td className="px-4 py-3 text-right">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await api('admin', `/api/pos-products/${encodeURIComponent(p.sku)}`, { method: 'DELETE' });
                      await products.reload();
                    } catch (e) {
                      setError(errorMessage(e));
                    }
                  }}
                >
                  Supprimer
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </section>
  );
}

/** "Remise assistée": how the cashier enters the advantage in the existing "Remise" menu of the till. */
function AssistedDiscountSettings() {
  const settings = useApi<TillSettings>('admin', '/api/privileges/settings');
  const [form, setForm] = useState<{ discountLabel: string; applyMode: ApplyMode; priceRequired: boolean } | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const current = form ?? (settings.data ? { ...settings.data } : null);

  if (!current) return settings.error ? <Alert>{settings.error}</Alert> : null;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    try {
      settings.setData(await api<TillSettings>('admin', '/api/pos-settings', { method: 'PUT', body: current }));
      setForm(null);
      setMessage({ tone: 'success', text: 'Paramètres enregistrés : ils s’appliquent immédiatement aux scanners.' });
    } catch (e) {
      setMessage({ tone: 'danger', text: errorMessage(e) });
    }
  };

  return (
    <section>
      <h2 className="mb-1 font-display text-xl font-semibold">Remise saisie dans la caisse</h2>
      <p className="mb-4 text-sm text-muted">
        Le caissier valide le QR code avec la tablette « Espace personnel », puis applique la remise dans la rubrique{' '}
        <strong>Remise</strong> de la caisse existante. La tablette lui indique exactement quoi saisir, et le{' '}
        <Link href="/admin/rapprochement" className="text-brand-700 underline">
          rapprochement
        </Link>{' '}
        compare ensuite l&apos;export des ventes avec les passages validés.
      </p>
      <Card>
        <form onSubmit={save} className="grid gap-4 md:grid-cols-3 md:items-end">
          <Field
            label="Nom de la remise dans la caisse"
            required
            value={current.discountLabel}
            onChange={(e) => setForm({ ...current, discountLabel: e.target.value })}
            hint="Tel qu'il apparaît dans la caisse et dans ses exports"
          />
          <Select
            label="Comment la caisse applique la remise"
            value={current.applyMode}
            onChange={(e) => setForm({ ...current, applyMode: e.target.value as ApplyMode })}
          >
            <option value="LINE_PERCENT">En % sur la ligne du plat</option>
            <option value="TICKET_AMOUNT">En montant sur le ticket</option>
          </Select>
          <label className="flex items-center gap-2 pb-3 text-sm">
            <input
              type="checkbox"
              checked={current.priceRequired}
              onChange={(e) => setForm({ ...current, priceRequired: e.target.checked })}
              className="h-4 w-4 accent-brand-700"
            />
            Prix du plat obligatoire sur la tablette
          </label>
          {current.applyMode === 'TICKET_AMOUNT' && !current.priceRequired && (
            <p className="text-sm text-amber-700 md:col-span-3">
              En montant sur le ticket, rendez le prix obligatoire : la tablette pourra alors afficher le montant exact à saisir.
            </p>
          )}
          <div className="md:col-span-3">
            <Button type="submit">Enregistrer</Button>
          </div>
        </form>
      </Card>
      {message && (
        <div className="mt-3">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}
    </section>
  );
}

export default function TillsPage() {
  return (
    <>
      <PageHeader
        title="Intégration caisse"
        subtitle="Remise saisie dans la caisse existante (rubrique Remise) et, si le logiciel de caisse le permet, connexion directe par API."
        actions={
          <Link href="/admin/caisses/simulateur" className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">
            Simulateur de caisse
          </Link>
        }
      />
      <div className="space-y-10">
        <AssistedDiscountSettings />
        <div className="border-t border-line pt-8">
          <p className="mb-6 text-sm text-muted">
            <strong>Caisse sans téléphone</strong> — le client scanne le QR de caisse collé sur le comptoir et montre la
            validation au caissier, qui applique la remise standard. Une douchette peut aussi être reliée (adresse donnée
            à la création de la caisse).
          </p>
          <div className="space-y-10">
            <Terminals />
            <Products />
          </div>
        </div>
      </div>
    </>
  );
}
