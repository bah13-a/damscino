'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

/** Shown when the page is opened from a partner activation link (?p=<partnerId>). */
export function PartnerWelcome() {
  const params = useSearchParams();
  const partnerId = params.get('p');
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!partnerId || !/^[0-9a-f-]{36}$/i.test(partnerId)) return;
    api<{ name: string; active: boolean }>(null, `/api/partners/${partnerId}/public`)
      .then((partner) => partner.active && setName(partner.name))
      .catch(() => undefined);
  }, [partnerId]);

  if (!name) return <>Installez l&apos;application, puis connectez-vous avec l&apos;identifiant et le mot de passe remis par votre entreprise.</>;
  return (
    <>
      Bienvenue aux collaborateurs de <strong className="text-gold-400">{name}</strong>. Installez l&apos;application, puis
      connectez-vous avec l&apos;identifiant remis par votre entreprise.
    </>
  );
}
