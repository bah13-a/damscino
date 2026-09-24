'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { InstallHint } from '@/components/InstallHint';
import { Alert, Badge, Button, Card, Logo, Spinner } from '@/components/ui';
import { api, errorMessage, logout } from '@/lib/api';
import { categoryLabel, dateTime, dt, longDate, PERIOD_LABEL, percent } from '@/lib/format';
import type { Availability, Dashboard } from '@/lib/types';
import { useSession } from '@/lib/useSession';

const AVAILABILITY_TONE: Record<Availability, 'success' | 'warning' | 'danger' | 'neutral'> = {
  AVAILABLE: 'success',
  USED: 'warning',
  CONVENTION_NOT_STARTED: 'neutral',
  CONVENTION_EXPIRED: 'danger',
  INACTIVE: 'danger',
  PENDING: 'neutral',
};

export default function BeneficiarySpacePage() {
  const router = useRouter();
  const session = useSession('beneficiary');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDashboard(await api<Dashboard>('beneficiary', '/api/privileges/me'));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    load();
    const onFocus = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onFocus);
    return () => document.removeEventListener('visibilitychange', onFocus);
  }, [session, load]);

  // a freshly imported account may take a few seconds to reach the privilege service
  useEffect(() => {
    if (dashboard?.availability !== 'PENDING') return;
    const timer = setTimeout(load, 3000);
    return () => clearTimeout(timer);
  }, [dashboard, load]);

  if (!session) return null;

  return (
    <main className="min-h-dvh pb-safe">
      <header className="bg-damask px-4 pb-16 pt-6 text-white">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Logo light />
          <button
            className="text-sm text-white/80 underline"
            onClick={async () => {
              await logout('beneficiary');
              router.replace('/connexion');
            }}
          >
            Déconnexion
          </button>
        </div>
        <div className="mx-auto mt-8 max-w-md">
          <p className="text-sm text-white/70">Bonjour</p>
          <p className="font-display text-2xl font-semibold">{dashboard?.fullName ?? session.displayName}</p>
          {dashboard?.partnerName && <p className="text-sm text-gold-400">{dashboard.partnerName}</p>}
        </div>
      </header>

      <div className="mx-auto -mt-10 max-w-md space-y-4 px-4">
        {error && <Alert>{error}</Alert>}
        {!dashboard && !error && (
          <Card className="flex justify-center py-10 text-brand-700">
            <Spinner />
          </Card>
        )}
        {dashboard && (
          <>
            <Card className="text-center">
              <Badge tone={AVAILABILITY_TONE[dashboard.availability]}>{dashboard.availabilityMessage}</Badge>
              {dashboard.discountPercent !== null && (
                <>
                  <p className="mt-4 font-display text-5xl font-semibold text-brand-700">−{percent(dashboard.discountPercent)}</p>
                  <p className="mt-1 text-sm text-muted">
                    sur {dashboard.usagesPerPeriod > 1 ? `${dashboard.usagesPerPeriod} plats` : 'un plat'} éligible par{' '}
                    {PERIOD_LABEL[dashboard.usagePeriod ?? 'DAY']}
                  </p>
                  <p className="mt-3 text-xs text-muted">
                    Éligible : {dashboard.eligibleCategories.map((c) => categoryLabel(c)).join(', ')}
                    {dashboard.excludedCategories.length > 0 &&
                      ` · Exclus : ${dashboard.excludedCategories.map((c) => categoryLabel(c)).join(', ')}`}
                  </p>
                </>
              )}
              {dashboard.availability === 'AVAILABLE' ? (
                <Link
                  href="/espace/qr"
                  className="mt-6 flex w-full items-center justify-center rounded-xl bg-brand-700 px-6 py-4 text-base font-semibold text-white transition hover:bg-brand-800"
                >
                  Utiliser mon avantage
                </Link>
              ) : (
                <Button size="lg" className="mt-6 w-full" disabled>
                  {dashboard.availability === 'USED' && dashboard.nextAvailableOn
                    ? `De nouveau disponible le ${longDate(dashboard.nextAvailableOn)}`
                    : 'Avantage indisponible'}
                </Button>
              )}
              {dashboard.conventionEnd && dashboard.availability !== 'CONVENTION_EXPIRED' && (
                <p className="mt-3 text-xs text-muted">Convention valable jusqu&apos;au {longDate(dashboard.conventionEnd)}</p>
              )}
            </Card>

            <InstallHint />

            <Card>
              <h2 className="font-display text-lg font-semibold">Mes passages</h2>
              {dashboard.history.length === 0 ? (
                <p className="mt-2 text-sm text-muted">Aucun passage pour le moment.</p>
              ) : (
                <ul className="mt-3 divide-y divide-line">
                  {dashboard.history.map((passage) => (
                    <li key={passage.id} className="flex items-center justify-between py-3 text-sm">
                      <span>{dateTime(passage.validatedAt)}</span>
                      <span className="font-semibold text-brand-700">
                        −{percent(passage.discountPercent)}
                        {passage.discountAmount !== null && <span className="ml-2 text-muted">({dt(passage.discountAmount)})</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <p className="pb-4 text-center text-xs text-muted">
              <Link href="/mot-de-passe?espace=beneficiary" className="underline">
                Changer mon mot de passe
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
