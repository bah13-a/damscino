'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';

export const ANDROID_APP_URL =
  process.env.NEXT_PUBLIC_ANDROID_APP_URL || 'https://github.com/bah13-a/damscino/releases/download/android-prod/damascino-privileges.apk';
export const IOS_APP_URL = process.env.NEXT_PUBLIC_IOS_APP_URL || '';

/** Store buttons + a QR code to open this page on a phone when it is displayed on a computer. */
export function AppDownload() {
  const [pageUrl, setPageUrl] = useState('');
  useEffect(() => setPageUrl(window.location.href), []);

  return (
    <div className="space-y-3">
      <a
        href={ANDROID_APP_URL}
        className="flex items-center justify-center gap-3 rounded-xl bg-white px-6 py-4 font-semibold text-brand-700 transition hover:bg-brand-50"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
          <path
            fill="currentColor"
            d="M17.6 9.48 19.44 6.3a.38.38 0 0 0-.66-.38l-1.87 3.23a11.4 11.4 0 0 0-9.82 0L5.22 5.92a.38.38 0 0 0-.66.38L6.4 9.48A10.8 10.8 0 0 0 1 18h22a10.8 10.8 0 0 0-5.4-8.52ZM7 15.25A1.25 1.25 0 1 1 8.25 14 1.25 1.25 0 0 1 7 15.25Zm10 0A1.25 1.25 0 1 1 18.25 14 1.25 1.25 0 0 1 17 15.25Z"
          />
        </svg>
        Télécharger pour Android
      </a>
      {IOS_APP_URL ? (
        <a
          href={IOS_APP_URL}
          className="flex items-center justify-center gap-3 rounded-xl border border-white/40 bg-white/10 px-6 py-4 font-semibold text-white transition hover:bg-white/20"
        >
          Télécharger pour iPhone
        </a>
      ) : (
        <p className="rounded-xl border border-white/20 px-4 py-3 text-center text-sm text-white/70">
          iPhone : l’application arrive sur l’App Store. En attendant, demandez un accès de test à Damascino.
        </p>
      )}
      {pageUrl && (
        <div className="hidden items-center gap-4 rounded-2xl bg-white p-4 text-ink md:flex">
          <QRCodeSVG value={pageUrl} size={96} level="M" />
          <p className="text-sm text-muted">Sur ordinateur ? Scannez ce code avec votre téléphone pour ouvrir cette page et installer l’application.</p>
        </div>
      )}
    </div>
  );
}
