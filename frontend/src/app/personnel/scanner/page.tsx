'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { QrScanner } from '@/components/QrScanner';
import { Alert, Button, Field, Logo, Spinner } from '@/components/ui';
import { api, errorMessage, logout } from '@/lib/api';
import { categoryLabel, dt, percent } from '@/lib/format';
import type { ScanResult, TillSettings } from '@/lib/types';
import { useSession } from '@/lib/useSession';

const IDLE_MINUTES = Number(process.env.NEXT_PUBLIC_STAFF_IDLE_MINUTES ?? 5);

type Step = { kind: 'scan' } | { kind: 'checking' } | { kind: 'result'; token: string; result: ScanResult };

/** What the cashier must now enter in the "Remise" menu of the till. */
function TillInstructions({ result, settings }: { result: ScanResult; settings: TillSettings | null }) {
  const label = settings?.discountLabel ?? 'Damascino Privilèges';
  const amountKnown = result.discountAmount !== null;
  return (
    <div className="mt-4 rounded-2xl bg-white p-4 text-ink" data-testid="till-instructions">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">À saisir maintenant dans la caisse</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
        <li>
          Rubrique <strong>Remise</strong> → <strong>« {label} »</strong>
        </li>
        {settings?.applyMode === 'TICKET_AMOUNT' ? (
          <li>
            Remise en montant sur le ticket :{' '}
            <strong>{amountKnown ? `−${dt(result.discountAmount)}` : `${percent(result.discountPercent)} du prix du plat`}</strong>
          </li>
        ) : (
          <li>
            <strong>{percent(result.discountPercent)}</strong> sur la ligne du plat
            {result.dishPrice !== null && <> à {dt(result.dishPrice)}</>}
            {amountKnown && <> (soit <strong>−{dt(result.discountAmount)}</strong>)</>}
          </li>
        )}
        {result.validationCode && (
          <li>
            Commentaire du ticket : <strong className="font-mono text-lg tracking-widest">{result.validationCode}</strong>
          </li>
        )}
      </ol>
    </div>
  );
}

export default function ScannerPage() {
  const router = useRouter();
  const session = useSession('staff');
  const [step, setStep] = useState<Step>({ kind: 'scan' });
  const [price, setPrice] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [settings, setSettings] = useState<TillSettings | null>(null);

  useEffect(() => {
    if (!session) return;
    api<TillSettings>('staff', '/api/privileges/settings').then(setSettings).catch(() => undefined);
  }, [session]);

  const signOut = useCallback(async () => {
    await logout('staff');
    router.replace('/personnel');
  }, [router]);

  // automatic sign-out of the scanner after inactivity
  useEffect(() => {
    if (!session) return;
    let timer = setTimeout(signOut, IDLE_MINUTES * 60_000);
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(signOut, IDLE_MINUTES * 60_000);
    };
    const events = ['pointerdown', 'keydown', 'touchstart'] as const;
    events.forEach((name) => window.addEventListener(name, reset));
    return () => {
      clearTimeout(timer);
      events.forEach((name) => window.removeEventListener(name, reset));
    };
  }, [session, signOut]);

  const verify = useCallback(async (token: string) => {
    setStep({ kind: 'checking' });
    setError(null);
    setPrice('');
    try {
      const result = await api<ScanResult>('staff', '/api/privileges/scan/verify', { method: 'POST', body: { token } });
      navigator.vibrate?.(result.status === 'VALID' ? 80 : [60, 60, 60]);
      setStep({ kind: 'result', token, result });
    } catch (e) {
      setError(errorMessage(e));
      setStep({ kind: 'scan' });
    }
  }, []);

  const confirm = async () => {
    if (step.kind !== 'result') return;
    setConfirming(true);
    setError(null);
    try {
      const value = price.trim().replace(',', '.');
      const result = await api<ScanResult>('staff', '/api/privileges/scan/confirm', {
        method: 'POST',
        body: { token: step.token, dishPrice: value === '' ? null : Number(value) },
      });
      setStep({ kind: 'result', token: step.token, result });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setConfirming(false);
    }
  };

  if (!session) return null;

  const result = step.kind === 'result' ? step.result : null;
  const green = result && result.status !== 'REFUSED';
  const priceValue = Number(price.replace(',', '.'));
  const preview = result?.discountPercent && price && !Number.isNaN(priceValue) ? (priceValue * result.discountPercent) / 100 : null;

  return (
    <main className="flex min-h-dvh flex-col bg-canvas">
      <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
        <Logo />
        <div className="text-right text-sm">
          <p className="font-semibold">{session.displayName}</p>
          <button onClick={signOut} className="text-muted underline">
            Déconnexion
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-md flex-1 space-y-4 p-4 pb-safe">
        {error && <Alert>{error}</Alert>}

        {step.kind === 'scan' && (
          <>
            <h1 className="font-display text-xl font-bold">Scanner le QR code du client</h1>
            <QrScanner active onScan={verify} />
            <details className="rounded-xl border border-line bg-surface p-3 text-sm">
              <summary className="cursor-pointer text-muted">Saisie manuelle du code</summary>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (manual.trim()) verify(manual.trim());
                }}
              >
                <input
                  value={manual}
                  onChange={(event) => setManual(event.target.value)}
                  placeholder="DP1…"
                  className="flex-1 rounded-lg border border-line bg-surface px-3 py-2"
                />
                <Button type="submit" size="sm">
                  Vérifier
                </Button>
              </form>
            </details>
          </>
        )}

        {step.kind === 'checking' && (
          <div className="flex flex-col items-center py-20 text-brand-700">
            <Spinner className="h-10 w-10" />
            <p className="mt-3 text-muted">Vérification…</p>
          </div>
        )}

        {result && (
          <div
            className={`rounded-3xl p-6 text-white shadow-lg ${green ? 'bg-emerald-600' : 'bg-red-600'}`}
            role="status"
            aria-live="assertive"
          >
            <div className="text-5xl" aria-hidden="true">
              {green ? '✓' : '✕'}
            </div>
            <h2 className="mt-2 text-2xl font-bold">
              {result.status === 'VALID' && 'Avantage valide'}
              {result.status === 'CONFIRMED' && 'Passage validé'}
              {result.status === 'REFUSED' && 'Refusé'}
            </h2>
            {result.status === 'REFUSED' && <p className="mt-1 text-lg">{result.message}</p>}
            {result.beneficiaryName && (
              <div className="mt-4 rounded-2xl bg-white/15 p-4">
                <p className="text-2xl font-bold">{result.beneficiaryName}</p>
                <p className="text-white/90">{result.partnerName}</p>
                {green && (
                  <p className="mt-2 text-lg font-semibold">
                    −{percent(result.discountPercent)} sur 1 plat éligible
                  </p>
                )}
                {green && result.eligibleCategories && (
                  <p className="text-sm text-white/90">
                    {result.eligibleCategories.map((c) => categoryLabel(c)).join(', ')}
                    {result.excludedCategories?.length
                      ? ` · hors ${result.excludedCategories.map((c) => categoryLabel(c)).join(', ')}`
                      : ''}
                  </p>
                )}
              </div>
            )}

            {result.status === 'VALID' && (
              <div className="mt-4 space-y-3 rounded-2xl bg-white p-4 text-ink">
                <Field
                  label={settings?.priceRequired ? 'Prix du plat remisé (DT)' : 'Prix du plat remisé (DT) — recommandé'}
                  inputMode="decimal"
                  placeholder="ex. 40"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  hint={
                    preview !== null
                      ? `Remise : ${dt(Math.round(preview * 1000) / 1000)}`
                      : settings?.priceRequired
                        ? 'Obligatoire : sert au rapprochement avec la caisse'
                        : 'Facultatif : sert à chiffrer les remises accordées'
                  }
                />
                <Button
                  size="lg"
                  className="w-full"
                  loading={confirming}
                  disabled={Boolean(settings?.priceRequired) && (price.trim() === '' || Number.isNaN(priceValue))}
                  onClick={confirm}
                >
                  Confirmer le passage
                </Button>
              </div>
            )}

            {result.status === 'CONFIRMED' && result.discountAmount !== null && (
              <p className="mt-4 text-lg">
                Remise accordée : <strong>{dt(result.discountAmount)}</strong> sur {dt(result.dishPrice)}
              </p>
            )}
            {result.status === 'CONFIRMED' && <TillInstructions result={result} settings={settings} />}

            <Button
              variant="secondary"
              size="lg"
              className="mt-4 w-full !border-white/40 !bg-white/10 !text-white"
              onClick={() => setStep({ kind: 'scan' })}
            >
              {result.status === 'VALID' ? 'Annuler' : 'Scanner un autre client'}
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
