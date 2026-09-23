'use client';

import { useEffect, useId, useRef, useState } from 'react';

interface Props {
  active: boolean;
  onScan: (text: string) => void;
}

/** Rear-camera QR reader (html5-qrcode, works on Chrome Android and Safari iOS 15+). */
export function QrScanner({ active, onScan }: Props) {
  const elementId = `qr-reader-${useId().replace(/:/g, '')}`;
  const onScanRef = useRef(onScan);
  const [error, setError] = useState<string | null>(null);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let scanner: import('html5-qrcode').Html5Qrcode | null = null;

    (async () => {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
      if (stopped) return;
      scanner = new Html5Qrcode(elementId, { formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE], verbose: false });
      try {
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: (width, height) => {
            const side = Math.floor(Math.min(width, height) * 0.75);
            return { width: side, height: side };
          } },
          (text) => {
            if (!stopped) onScanRef.current(text);
          },
          () => undefined,
        );
        setError(null);
      } catch {
        setError("Caméra inaccessible. Autorisez l'accès à la caméra dans les réglages du navigateur (HTTPS requis).");
      }
    })();

    return () => {
      stopped = true;
      if (scanner?.isScanning) {
        scanner.stop().then(() => scanner?.clear()).catch(() => undefined);
      }
    };
  }, [active, elementId]);

  return (
    <div>
      <div id={elementId} className="overflow-hidden rounded-2xl bg-black [&_video]:!w-full [&_video]:object-cover" />
      {error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    </div>
  );
}
