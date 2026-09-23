import Link from 'next/link';
import { Logo } from '@/components/ui';

export default function HomePage() {
  return (
    <main className="bg-damask flex min-h-dvh flex-col px-4 py-8 text-white">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <Logo light />
        <div className="flex flex-1 flex-col justify-center py-10">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-gold-400">Programme partenaires</p>
          <h1 className="mt-3 font-display text-4xl font-bold leading-tight">
            −20 % sur votre plat,
            <br />
            chaque jour.
          </h1>
          <p className="mt-4 text-white/80">
            Réservé aux collaborateurs des entreprises partenaires de Damascino. Connectez-vous avec l&apos;identifiant
            remis par votre entreprise et présentez votre QR code en caisse.
          </p>
          <Link
            href="/connexion"
            className="mt-8 inline-flex items-center justify-center rounded-xl bg-gold-500 px-6 py-4 font-semibold text-brand-900 transition hover:bg-gold-400"
          >
            Accéder à mon avantage
          </Link>
        </div>
        <nav className="flex justify-center gap-6 pb-safe text-sm text-white/70">
          <Link href="/personnel" className="hover:text-white">
            Espace personnel
          </Link>
          <Link href="/admin/connexion" className="hover:text-white">
            Administration
          </Link>
        </nav>
      </div>
    </main>
  );
}
