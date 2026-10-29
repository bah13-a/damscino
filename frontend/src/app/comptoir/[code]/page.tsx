'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppDownload } from '@/components/AppDownload';
import { Logo, MotifBand, Spinner } from '@/components/ui';

/**
 * Opened when the counter QR code is scanned with the phone camera instead of the app: it grants nothing (the right
 * comes from the account signed in to the app) and explains how to use the advantage.
 */
export default function CounterPage() {
  const { code } = useParams<{ code: string }>();
  const [till, setTill] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    fetch(`/api/privileges/counter/${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setTill(data?.tillName ?? null))
      .catch(() => setTill(null));
  }, [code]);

  return (
    <main className="bg-damask flex min-h-dvh flex-col px-4 py-8 text-white">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <Logo light size="lg" />
        <div className="flex flex-1 flex-col justify-center py-10">
          {till === undefined ? (
            <Spinner className="h-8 w-8" />
          ) : till === null ? (
            <>
              <h1 className="font-display text-3xl font-semibold">QR code de caisse inconnu</h1>
              <p className="mt-3 text-white/80">Ce code n&apos;est plus valable. Demandez au caissier.</p>
            </>
          ) : (
            <>
              <p className="font-display text-sm font-medium uppercase tracking-[0.25em] text-gold-400">{till}</p>
              <h1 className="mt-3 font-display text-3xl font-semibold leading-tight">Utilisez votre avantage avec l&apos;application</h1>
              <ol className="mt-6 space-y-3 text-white/90">
                <li>1. Ouvrez l&apos;application Damascino Privilèges.</li>
                <li>2. Touchez « Utiliser mon avantage ».</li>
                <li>3. Scannez de nouveau ce QR code, puis montrez l&apos;écran « Remise validée » au caissier.</li>
              </ol>
              <p className="mt-4 text-sm text-white/70">Scanner ce code avec l&apos;appareil photo ne valide pas la remise.</p>
              <div className="mt-8">
                <AppDownload />
              </div>
            </>
          )}
        </div>
        <MotifBand tone="white" className="mb-6 opacity-30" />
      </div>
    </main>
  );
}
