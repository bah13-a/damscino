import { AuthShell } from '@/components/AuthShell';

export default function OfflinePage() {
  return (
    <AuthShell title="Vous êtes hors ligne" subtitle="Le QR code est généré en direct : une connexion Internet est nécessaire.">
      <p className="text-sm text-muted">Vérifiez votre connexion (Wi-Fi ou données mobiles) puis rouvrez l&apos;application.</p>
    </AuthShell>
  );
}
