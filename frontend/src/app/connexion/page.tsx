import Link from 'next/link';
import { Suspense } from 'react';
import { AuthShell } from '@/components/AuthShell';
import { LoginForm } from '@/components/LoginForm';
import { PartnerWelcome } from '@/components/PartnerWelcome';

export default function BeneficiaryLoginPage() {
  return (
    <AuthShell
      title="Mon avantage"
      subtitle={
        <Suspense>
          <PartnerWelcome />
        </Suspense>
      }
      footer={
        <>
          Mot de passe oublié ? Demandez une réinitialisation à Damascino ou à votre entreprise.
          <br />
          <Link href="/" className="mt-2 inline-block underline">
            Retour
          </Link>
        </>
      }
    >
      <Suspense>
        <LoginForm space="beneficiary" />
      </Suspense>
    </AuthShell>
  );
}
