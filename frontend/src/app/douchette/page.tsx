'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Alert, Button, Field, Logo, MotifBand, Spinner } from '@/components/ui';
import { ApiError } from '@/lib/api';

/**
 * Handheld scanner station: the page stays open in the browser of the till PC, where the scanner is plugged in (USB,
 * keyboard mode). The administration hands out its link (Caisses → Postes de caisse); the link carries the till's API
 * key, kept on this PC, so the cashier never signs in. Each scan validates the passage and is shown on the customer's
 * phone; the cashier then applies the standard discount in the till.
 */

const KEY = 'dp.douchette.key';
const CASHIER = 'dp.douchette.cashier';
/** Complete signed code (DP1.<payload>.<43-character signature>): submitted even without Enter after it. */
const FULL_TOKEN = /^DP1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/;

interface Result {
  valid: boolean;
  reason: string | null;
  message: string;
  discountName: string;
  discountPercent: number | null;
  clientName: string | null;
  partnerName: string | null;
  validationCode: string | null;
}

interface Scan {
  at: Date;
  result: Result;
}

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // private browsing: the station works until the page is closed
  }
};

async function call<T>(apiKey: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'X-Api-Key': apiKey, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(response.status, data.code ?? 'ERROR', data.message ?? `Erreur ${response.status}`);
  }
  return response.json();
}

/** Short tone: high for a valid code, low and double for a refusal (the cashier may not be looking at the screen). */
function beep(valid: boolean) {
  try {
    const audio = new AudioContext();
    const tones = valid ? [880] : [220, 220];
    tones.forEach((frequency, i) => {
      const oscillator = audio.createOscillator();
      oscillator.frequency.value = frequency;
      oscillator.connect(audio.destination);
      oscillator.start(audio.currentTime + i * 0.25);
      oscillator.stop(audio.currentTime + i * 0.25 + 0.18);
    });
  } catch {
    // no sound available
  }
}

const time = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Africa/Tunis' });

function ResultPanel({ scan }: { scan: Scan }) {
  const { result } = scan;
  return (
    <div
      data-testid="douchette-result"
      role="status"
      aria-live="assertive"
      className={`rounded-3xl p-6 text-white shadow-xl ${result.valid ? 'bg-emerald-600' : 'bg-red-700'}`}
    >
      <p className="text-5xl" aria-hidden="true">
        {result.valid ? '✓' : '✕'}
      </p>
      <h2 className="mt-2 font-display text-3xl font-semibold">{result.valid ? 'Avantage valide' : 'Refusé'}</h2>
      {result.valid ? (
        <>
          <p className="mt-4 rounded-2xl bg-white/15 p-4 text-xl">
            Appliquer dans la caisse la remise <strong>« {result.discountName} »</strong>
            {result.discountPercent !== null && (
              <>
                {' '}
                : <strong>{result.discountPercent} %</strong> sur un plat
              </>
            )}
          </p>
          {result.validationCode && (
            <p className="mt-3 text-lg">
              Code à noter sur le ticket : <strong className="font-mono tracking-widest">{result.validationCode}</strong>
            </p>
          )}
        </>
      ) : (
        <p className="mt-4 text-xl">{result.message}</p>
      )}
      {result.clientName && (
        <p className="mt-4 text-white/90">
          {result.clientName}
          {result.partnerName ? ` · ${result.partnerName}` : ''}
        </p>
      )}
      <p className="mt-1 text-sm text-white/70">{time.format(scan.at)}</p>
    </div>
  );
}

export default function HandheldStationPage() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [station, setStation] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [cashier, setCashier] = useState('');
  const [value, setValue] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const input = useRef<HTMLInputElement>(null);

  // the link of the administration (…/douchette#cle=…) installs the key on this PC, then disappears from the address bar
  useEffect(() => {
    const fromLink = new URLSearchParams(window.location.hash.slice(1)).get('cle');
    if (fromLink) {
      write(KEY, fromLink);
      window.history.replaceState(null, '', window.location.pathname);
    }
    setApiKey(fromLink ?? read(KEY));
    setCashier(read(CASHIER) ?? '');
    setReady(true);
  }, []);

  useEffect(() => {
    if (!apiKey) return;
    call<{ terminal: string }>(apiKey, '/api/pos/v1/ping')
      .then((ping) => {
        setStation(ping.terminal);
        setSetupError(null);
      })
      .catch((e) =>
        setSetupError(
          e instanceof ApiError && (e.status === 401 || e.status === 403)
            ? 'Ce poste n’est plus autorisé (clé révoquée ou remplacée). Demandez un nouveau lien à l’administrateur.'
            : 'Serveur injoignable : vérifiez la connexion Internet du PC.',
        ),
      );
  }, [apiKey]);

  // every scan must land in the code field, unless the cashier is typing their name
  const focus = useCallback(() => {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement && active !== input.current) return;
    input.current?.focus();
  }, []);
  useEffect(() => {
    if (!station) return;
    focus();
    const timer = setInterval(focus, 1000);
    return () => clearInterval(timer);
  }, [station, focus]);

  const validate = async (text: string) => {
    const qrCode = text.trim();
    setValue('');
    if (!qrCode || !apiKey || checking) return;
    setChecking(true);
    setError(null);
    try {
      const result = await call<Result>(apiKey, '/api/pos/v1/validate-qr', { qrCode, cashier: cashier.trim() || null });
      beep(result.valid);
      setScans((previous) => [{ at: new Date(), result }, ...previous].slice(0, 6));
    } catch (e) {
      beep(false);
      setError(e instanceof Error ? e.message : 'Erreur inattendue, scannez à nouveau.');
    } finally {
      setChecking(false);
      focus();
    }
  };

  if (!ready) return null;

  return (
    <main className="bg-damask flex min-h-dvh flex-col px-4 py-6 text-white">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <Logo light size="sm" />
          <div className="text-right text-sm text-white/80">
            <p className="font-semibold text-white">Poste douchette</p>
            {station && <p data-testid="douchette-station">{station}</p>}
          </div>
        </header>

        {!apiKey ? (
          <div className="rounded-3xl bg-surface p-6 text-ink">
            <h1 className="font-display text-2xl font-semibold">Poste non configuré</h1>
            <p className="mt-2 text-muted">
              Ouvrez sur ce PC le lien du poste douchette donné par l’administration (Administration → Intégration caisse →
              Caisses et douchettes → « Autres branchements »).
            </p>
          </div>
        ) : setupError ? (
          <div className="rounded-3xl bg-surface p-6 text-ink">
            <Alert>{setupError}</Alert>
            <Button className="mt-4" variant="secondary" onClick={() => window.location.reload()}>
              Réessayer
            </Button>
          </div>
        ) : !station ? (
          <div className="flex justify-center py-20">
            <Spinner className="h-10 w-10" />
          </div>
        ) : (
          <>
            <form onSubmit={(event: FormEvent) => event.preventDefault()} className="rounded-3xl bg-surface p-6 text-ink shadow-xl" onClick={focus}>
              <h1 className="font-display text-2xl font-semibold">Scannez le QR code du client</h1>
              <p className="mt-1 text-sm text-muted">
                La douchette écrit le code ici ; le résultat s’affiche ci-dessous et sur le téléphone du client.
              </p>
              <label htmlFor="douchette-code" className="sr-only">
                Code lu par la douchette
              </label>
              <input
                id="douchette-code"
                ref={input}
                value={value}
                onChange={(e) => (FULL_TOKEN.test(e.target.value.trim()) ? validate(e.target.value) : setValue(e.target.value))}
                // Enter sent by the scanner after the code (the form has two fields: no implicit submission)
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  validate(value);
                }}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder={checking ? 'Vérification…' : 'En attente du scan…'}
                className="mt-4 w-full rounded-xl border-2 border-dashed border-brand-700 bg-canvas px-4 py-4 font-mono text-sm focus:outline-none"
              />
              <div className="mt-4 max-w-xs">
                <Field
                  label="Caissier (facultatif)"
                  placeholder="ex. Sami"
                  value={cashier}
                  onChange={(e) => {
                    setCashier(e.target.value);
                    write(CASHIER, e.target.value.trim() || null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    input.current?.focus();
                  }}
                  onBlur={focus}
                />
              </div>
            </form>

            {error && <Alert>{error}</Alert>}
            {scans[0] && <ResultPanel scan={scans[0]} />}

            {scans.length > 1 && (
              <section className="rounded-3xl bg-white/10 p-4 text-sm">
                <h2 className="mb-2 font-semibold">Scans précédents</h2>
                <ul className="space-y-1">
                  {scans.slice(1).map((scan) => (
                    <li key={scan.at.getTime()} className="flex justify-between gap-4">
                      <span>
                        {scan.result.valid ? '✓' : '✕'} {scan.result.clientName ?? scan.result.message}
                      </span>
                      <span className="text-white/70">{time.format(scan.at)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
        <MotifBand tone="white" className="mt-auto opacity-30" />
      </div>
    </main>
  );
}
