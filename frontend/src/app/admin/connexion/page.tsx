import Link from 'next/link';
import { Suspense } from 'react';
import { AuthShell } from '@/components/AuthShell';
import { LoginForm } from '@/components/LoginForm';

export default function AdminLoginPage() {
  return (
    <AuthShell
      title="Administration"
      subtitle="Partenaires, bénéficiaires, règles, statistiques et exports."
      footer={
        <Link href="/" className="underline">
          Retour
        </Link>
      }
    >
      <Suspense>
        <LoginForm space="admin" />
      </Suspense>
    </AuthShell>
  );
}
