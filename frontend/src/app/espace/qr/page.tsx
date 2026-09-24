'use client';

import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Card, Spinner } from '@/components/ui';
import { api, ApiError, errorMessage } from '@/lib/api';
import { dt, percent } from '@/lib/format';
import type { Dashboard, QrCode } from '@/lib/types';
import { useSession } from '@/lib/useSession';

type WakeLock = { release: () => Promise<void> };

/** QR code of the day: renewed every 30 s, closed automatically once validated at the till. */
export default function QrPage() {
  const session = useSession('beneficiary');
  const [qr, setQr] = useState<QrCode | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validated, setValidated] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const fetchedAt = useRef(0);

  const refreshQr = useCallback(async () => {
    try {
      const code = await api<QrCode>('beneficiary', '/api/privileges/qr', { method: 'POST' });
      fetchedAt.current = Date.now();
      setQr(code);
      setError(null);
    } catch (e) {
      setQr(null);
      if (e instanceof ApiError && e.code === 'QUOTA_REACHED') {
        setValidated(true);
      } else {
        setError(errorMessage(e));
      }
    }
  }, []);

  // first code + dashboard
  useEffect(() => {
    if (!session) return;
    refreshQr();
    api<Dashboard>('beneficiary', '/api/privileges/me').then(setDashboard).catch(() => undefined);
  }, [session, refreshQr]);

  // renew the code on the interval announced by the server
  useEffect(() => {
    if (!qr || validated) return;
    const timer = setTimeout(refreshQr, qr.refreshInSeconds * 1000);
    return () => clearTimeout(timer);
  }, [qr, validated, refreshQr]);

  // detect the validation at the till
  useEffect(() => {
    if (!session || validated || error) return;
    const timer = setInterval(async () => {
      try {
        const current = await api<Dashboard>('beneficiary', '/api/privileges/me');
        setDashboard(current);
        if (current.availability === 'USED') setValidated(true);
      } catch {
        // keep showing the code; the next renewal will surface real errors
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [session, validated, error]);

  // live clock (helps the cashier spot a screenshot) + keep the screen awake
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    let lock: WakeLock | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLock> } };
    nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => undefined);
    const onVisible = () => document.visibilityState === 'visible' && !validated && refreshQr();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(tick);
      lock?.release().catch(() => undefined);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshQr, validated]);

  if (!session) return null;

  const remaining = qr ? Math.max(0, qr.refreshInSeconds - Math.floor((now - fetchedAt.current) / 1000)) : 0;
  const lastPassage = dashboard?.history[0];

  return (
    <main className="bg-damask flex min-h-dvh flex-col items-center px-4 py-6 pb-safe text-white">
      <div className="flex w-full max-w-sm items-center justify-between">
        <Link href="/espace" className="text-sm text-white/80 underline">
          ← Retour
        </Link>
        <span className="font-mono text-sm tabular-nums text-gold-400">
          {new Intl.DateTimeFormat('fr-FR', { timeStyle: 'medium', timeZone: 'Africa/Tunis' }).format(now)}
        </span>
      </div>

      <div className="mt-6 w-full max-w-sm">
        {validated ? (
          <Card className="text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl text-emerald-700">✓</div>
            <h1 className="mt-4 font-display text-2xl font-semibold text-ink">Avantage utilisé</h1>
            <p className="mt-2 text-muted">
              {lastPassage
                ? `Remise de ${percent(lastPassage.discountPercent)}${lastPassage.discountAmount !== null ? ` (${dt(lastPassage.discountAmount)})` : ''} appliquée.`
                : 'Votre passage a bien été enregistré.'}{' '}
              Bon appétit !
            </p>
            <Link href="/espace" className="mt-6 inline-block rounded-xl bg-brand-700 px-6 py-3 font-semibold text-white">
              Terminer
            </Link>
          </Card>
        ) : error ? (
          <Card className="space-y-4 text-center">
            <Alert>{error}</Alert>
            <Link href="/espace" className="inline-block rounded-xl bg-brand-700 px-6 py-3 font-semibold text-white">
              Retour à mon espace
            </Link>
          </Card>
        ) : (
          <Card className="text-center">
            <p className="font-display text-xl font-semibold text-ink">{dashboard?.fullName ?? session.displayName}</p>
            {dashboard?.partnerName && <p className="text-sm text-muted">{dashboard.partnerName}</p>}
            <div className="relative mx-auto mt-4 flex aspect-square w-full max-w-[280px] items-center justify-center rounded-2xl bg-white p-3">
              {qr ? (
                <QRCodeSVG value={qr.token} size={256} level="M" className="h-full w-full" />
              ) : (
                <Spinner className="h-10 w-10 text-brand-700" />
              )}
            </div>
            <div className="live-bar relative mx-auto mt-3 h-1 w-40 overflow-hidden rounded-full bg-line" aria-hidden="true" />
            <p className="mt-3 text-sm text-muted">
              Présentez ce code en caisse · nouveau code dans <span className="font-semibold tabular-nums text-ink">{remaining}s</span>
            </p>
            <p className="mt-2 text-xs text-muted">Valable pour un seul plat éligible. Les captures d&apos;écran ne fonctionnent pas.</p>
          </Card>
        )}
      </div>
    </main>
  );
}
