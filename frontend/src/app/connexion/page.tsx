import { Suspense } from 'react';
import { AppLanding } from '@/components/AppLanding';
import { PartnerWelcome } from '@/components/PartnerWelcome';

/** Target of the partner activation link: the collaborators are sent to the app. */
export default function BeneficiaryAccessPage() {
  return (
    <AppLanding
      audience="beneficiary"
      title="Mon avantage Damascino"
      intro={
        <Suspense>
          <PartnerWelcome />
        </Suspense>
      }
    />
  );
}
