'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

/** "Ajouter à l'écran d'accueil": native prompt on Android, instructions on iPhone. Hidden once installed. */
export function InstallHint() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem('dp.install.dismissed') === '1';
    } catch {
      // ignore
    }
    if (standalone || dismissed) return;
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setHidden(false);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (hidden || (!prompt && !ios)) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      window.localStorage.setItem('dp.install.dismissed', '1');
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-line bg-brand-50 p-4 text-sm">
      <span aria-hidden="true" className="text-xl">
        📲
      </span>
      <div className="flex-1">
        <p className="font-semibold">Ajoutez Privilèges à votre écran d&apos;accueil</p>
        {prompt ? (
          <button className="mt-1 font-semibold text-brand-700 underline" onClick={() => prompt.prompt().then(dismiss)}>
            Installer l&apos;application
          </button>
        ) : (
          <p className="mt-1 text-muted">
            Dans Safari, touchez <strong>Partager</strong> puis <strong>Sur l&apos;écran d&apos;accueil</strong>.
          </p>
        )}
      </div>
      <button onClick={dismiss} className="text-muted" aria-label="Masquer">
        ✕
      </button>
    </div>
  );
}
