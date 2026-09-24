import type { ReactNode } from 'react';
import { Logo, MotifBand } from './ui';

/** Branded frame of the public screens (login, password change). */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="bg-damask flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-3">
        <Logo light size="lg" />
      </div>
      <MotifBand tone="white" className="mb-8 w-48 opacity-30" />
      <div className="w-full max-w-sm rounded-3xl bg-surface p-6 shadow-2xl">
        <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
        {subtitle && <div className="mb-5 mt-1 text-sm text-muted">{subtitle}</div>}
        {!subtitle && <div className="mb-5" />}
        {children}
      </div>
      {footer && <div className="mt-6 text-center text-sm text-white/80">{footer}</div>}
    </main>
  );
}
