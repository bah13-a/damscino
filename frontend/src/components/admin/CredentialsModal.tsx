'use client';

import { useState } from 'react';
import { phone } from '@/lib/format';
import type { IssuedCredentials } from '@/lib/types';
import { Alert, Button, Modal } from '../ui';

/** Displays a generated access once, so that it can be handed over to the beneficiary. */
export function CredentialsModal({ credentials, onClose }: { credentials: IssuedCredentials | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  if (!credentials) return null;
  const text = `Damascino Privilèges\nIdentifiant : ${credentials.phone}\nMot de passe temporaire : ${credentials.temporaryPassword}\nConnexion : ${window.location.origin}/connexion`;
  return (
    <Modal open title="Accès généré" onClose={onClose}>
      <p className="text-sm text-muted">
        {credentials.firstName} {credentials.lastName} devra changer ce mot de passe à sa première connexion.
      </p>
      <dl className="mt-4 space-y-2 rounded-xl bg-canvas p-4">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Identifiant</dt>
          <dd className="font-mono font-semibold">{phone(credentials.phone)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Mot de passe temporaire</dt>
          <dd className="font-mono font-semibold">{credentials.temporaryPassword}</dd>
        </div>
      </dl>
      <div className="mt-4 flex gap-2">
        <Button
          variant="secondary"
          onClick={async () => {
            await navigator.clipboard?.writeText(text);
            setCopied(true);
          }}
        >
          {copied ? 'Copié ✓' : 'Copier le message'}
        </Button>
        <Button onClick={onClose}>Fermer</Button>
      </div>
      <div className="mt-4">
        <Alert tone="info">Tant que le compte n&apos;est pas activé, cet accès reste disponible dans l&apos;export des accès du partenaire.</Alert>
      </div>
    </Modal>
  );
}
