import Link from 'next/link';
import { Suspense } from 'react';
import { AuthShell } from '@/components/AuthShell';
import { LoginForm } from '@/components/LoginForm';

export default function StaffLoginPage() {
  return (
    <AuthShell
      title="Espace personnel"
      subtitle="Connexion individuelle serveur / caissier : chaque validation est tracée à votre nom."
      footer={
        <Link href="/" className="underline">
          Retour
        </Link>
      }
    >
      <Suspense>
        <LoginForm space="staff" />
      </Suspense>
    </AuthShell>
  );
}
