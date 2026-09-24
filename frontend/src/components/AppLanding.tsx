import Link from 'next/link';
import type { ReactNode } from 'react';
import { AppDownload } from './AppDownload';
import { Logo, MotifBand } from './ui';

const STEPS = {
  beneficiary: [
    "Installez l'application Damascino Privilèges sur votre téléphone.",
    "Ouvrez-la, choisissez « Je suis bénéficiaire » et connectez-vous avec l'identifiant (votre numéro de téléphone) et le mot de passe remis par votre entreprise.",
    'Choisissez votre mot de passe, puis présentez votre QR code en caisse.',
  ],
  staff: [
    "Installez l'application Damascino Privilèges sur la tablette ou le téléphone de caisse.",
    'Ouvrez-la, choisissez « Personnel Damascino » et connectez-vous avec votre identifiant et votre code PIN.',
    'Scannez le QR code du client, puis suivez les indications à l’écran.',
  ],
};

/** Public page of the site: beneficiaries and till staff use the mobile app, only the administration uses the web. */
export function AppLanding({ audience, title, intro }: { audience: 'beneficiary' | 'staff'; title: ReactNode; intro: ReactNode }) {
  return (
    <main className="bg-damask flex min-h-dvh flex-col px-4 py-8 text-white">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <Logo light size="lg" />
        <div className="flex flex-1 flex-col justify-center py-10">
          <p className="font-display text-sm font-medium uppercase tracking-[0.25em] text-gold-400">Application mobile</p>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-tight">{title}</h1>
          <div className="mt-4 text-white/80">{intro}</div>
          <div className="mt-8">
            <AppDownload />
          </div>
          <ol className="mt-8 space-y-3 text-sm text-white/80">
            {STEPS[audience].map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-semibold">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <MotifBand tone="white" className="mb-6 opacity-30" />
        <nav className="flex justify-center gap-6 pb-safe text-sm text-white/70">
          {audience === 'beneficiary' ? (
            <Link href="/personnel" className="hover:text-white">
              Personnel Damascino
            </Link>
          ) : (
            <Link href="/" className="hover:text-white">
              Bénéficiaires
            </Link>
          )}
          <Link href="/admin/connexion" className="hover:text-white">
            Administration
          </Link>
        </nav>
      </div>
    </main>
  );
}
