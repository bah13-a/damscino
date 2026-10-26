'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Logo, MotifBand } from '@/components/ui';
import { logout } from '@/lib/api';
import { useSession } from '@/lib/useSession';

const NAV = [
  { href: '/admin', label: 'Tableau de bord' },
  { href: '/admin/partenaires', label: 'Partenaires' },
  { href: '/admin/beneficiaires', label: 'Bénéficiaires' },
  { href: '/admin/utilisations', label: 'Utilisations' },
  { href: '/admin/categories', label: 'Catégories' },
  { href: '/admin/caisses', label: 'Caisses' },
  { href: '/admin/rapprochement', label: 'Rapprochement' },
  { href: '/admin/comptes', label: 'Comptes' },
  { href: '/admin/messagerie', label: 'Messagerie' },
  { href: '/admin/journal', label: 'Journal' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const session = useSession('admin');
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!session) return null;

  const isActive = (href: string) => (href === '/admin' ? pathname === href : pathname.startsWith(href));

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setOpen(false)}
          className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
            isActive(item.href) ? 'bg-white text-brand-700' : 'text-white/80 hover:bg-white/10 hover:text-white'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );

  const account = (
    <div className="border-t border-white/15 pt-4 text-sm text-white">
      <p className="font-semibold">{session.displayName}</p>
      <div className="mt-1 flex gap-3 text-white/70">
        <Link href="/mot-de-passe?espace=admin" className="underline">
          Mot de passe
        </Link>
        <button
          className="underline"
          onClick={async () => {
            await logout('admin');
            router.replace('/admin/connexion');
          }}
        >
          Déconnexion
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="hidden w-64 shrink-0 flex-col justify-between bg-brand-700 p-5 lg:flex lg:sticky lg:top-0 lg:h-dvh">
        <div className="space-y-8">
          <Logo light size="sm" />
          {nav}
        </div>
        <div className="space-y-4">
          <MotifBand tone="white" className="opacity-20" />
          {account}
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex items-center justify-between bg-brand-700 px-4 py-3 lg:hidden">
        <Logo light size="sm" />
        <button onClick={() => setOpen(!open)} className="rounded-lg border border-white/30 px-3 py-1.5 text-sm text-white" aria-expanded={open}>
          Menu
        </button>
      </header>
      {open && (
        <div className="space-y-4 bg-brand-700 p-4 lg:hidden">
          {nav}
          {account}
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8">{children}</main>
    </div>
  );
}
