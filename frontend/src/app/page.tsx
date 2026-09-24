import { AppLanding } from '@/components/AppLanding';

export default function HomePage() {
  return (
    <AppLanding
      audience="beneficiary"
      title={
        <>
          Votre avantage Damascino,
          <br />
          dans votre poche.
        </>
      }
      intro="Réservé aux collaborateurs des entreprises partenaires de Damascino : une remise sur un plat éligible, avec un QR code personnel renouvelé toutes les 30 secondes dans l’application."
    />
  );
}
