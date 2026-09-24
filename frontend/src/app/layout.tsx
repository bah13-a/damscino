import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { PwaRegister } from '@/components/PwaRegister';
import './globals.css';

export const metadata: Metadata = {
  title: 'Damascino Privilèges',
  description: 'Votre avantage Damascino : -20 % sur un plat, avec un QR code personnel renouvelé toutes les 30 secondes.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Damascino Privilèges',
  appleWebApp: { capable: true, title: 'Privilèges', statusBarStyle: 'black-translucent' },
  icons: {
    icon: [{ url: '/icons/icon.svg', type: 'image/svg+xml' }, { url: '/icons/icon-192.png', sizes: '192x192' }],
    apple: '/icons/apple-touch-icon.png',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#131F35',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@500;600&display=swap"
        />
      </head>
      <body className="antialiased">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
