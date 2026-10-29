'use client';

import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Alert, Button, Logo, MotifBand, Spinner } from '@/components/ui';
import type { PosTerminal } from '@/lib/types';
import { useApi } from '@/lib/useApi';
import { useSession } from '@/lib/useSession';

/** Counter label of a till, to print and stick next to it: customers scan it with the app to use their advantage. */
function Label() {
  const session = useSession('admin');
  const id = useSearchParams().get('caisse');
  const terminals = useApi<PosTerminal[]>('admin', session ? '/api/pos-terminals' : null);
  const terminal = terminals.data?.find((t) => t.id === id);

  if (!session) return null;
  if (terminals.error) return <Alert>{terminals.error}</Alert>;
  if (!terminals.data) return <Spinner />;
  if (!terminal) return <Alert>Caisse introuvable.</Alert>;

  const url = `${window.location.origin}/comptoir/${terminal.counterCode}`;
  return (
    <>
      <div className="mb-6 flex gap-2 print:hidden">
        <Button onClick={() => window.print()}>Imprimer l&apos;étiquette</Button>
        <Link href="/admin/caisses" className="rounded-xl px-4 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50">
          Retour aux caisses
        </Link>
      </div>
      {!terminal.active && (
        <div className="mb-6 print:hidden">
          <Alert>Cette caisse est révoquée : son QR code est refusé. Réactivez-la avant d&apos;imprimer.</Alert>
        </div>
      )}
      <article
        data-testid="counter-label"
        className="mx-auto flex w-full max-w-md flex-col items-center rounded-3xl border-4 border-brand-700 bg-white p-8 text-center text-ink print:border-2"
      >
        <div className="rounded-2xl bg-brand-700 px-5 py-3">
          <Logo light size="md" />
        </div>
        <h1 className="mt-6 font-display text-3xl font-semibold">Votre avantage Damascino Privilèges</h1>
        <p className="mt-3 text-lg">
          Ouvrez l&apos;application, touchez <strong>« Utiliser mon avantage »</strong> et scannez ce code.
        </p>
        <div className="my-6 rounded-2xl bg-white p-3">
          <QRCodeSVG value={url} size={260} level="M" data-testid="counter-qr" />
        </div>
        <p className="text-sm text-muted">Puis montrez l&apos;écran « Remise validée » au caissier.</p>
        <p className="mt-4 font-semibold">{terminal.name}</p>
        <MotifBand tone="navy" className="mt-6 w-40 opacity-40" />
      </article>
    </>
  );
}

export default function CounterLabelPage() {
  return (
    <main className="min-h-dvh bg-canvas px-4 py-8 print:bg-white print:p-0">
      <Suspense>
        <Label />
      </Suspense>
    </main>
  );
}
