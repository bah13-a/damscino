'use client';

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { useEffect, useId } from 'react';

const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-600',
  secondary: 'border border-line bg-surface text-ink hover:bg-canvas',
  ghost: 'text-brand-700 hover:bg-brand-50',
  danger: 'bg-red-700 text-white hover:bg-red-800',
  gold: 'bg-white text-brand-700 hover:bg-brand-50',
};

export function Button({
  variant = 'primary',
  loading = false,
  size = 'md',
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
        size === 'sm' && 'px-3 py-1.5 text-sm',
        size === 'md' && 'px-4 py-2.5 text-sm',
        size === 'lg' && 'px-6 py-4 text-base',
        VARIANTS[variant],
        className,
      )}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function Spinner({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={cx('animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function Field({
  label,
  error,
  hint,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        {...props}
        className={cx(
          'w-full rounded-xl border bg-surface px-3 py-2.5 text-ink outline-none transition placeholder:text-muted focus:border-brand-700 focus:ring-2 focus:ring-brand-700/20',
          error ? 'border-red-600' : 'border-line',
        )}
      />
      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Select({
  label,
  children,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  const id = useId();
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <select
        id={id}
        {...props}
        className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-ink outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-700/20"
      >
        {children}
      </select>
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-2xl border border-line bg-surface p-5 shadow-sm', className)}>{children}</div>;
}

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'brand';

const TONES: Record<Tone, string> = {
  neutral: 'bg-line/60 text-ink',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  danger: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  brand: 'bg-brand-50 text-brand-700',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', TONES[tone])}>{children}</span>;
}

export function Alert({ tone = 'danger', children }: { tone?: 'danger' | 'success' | 'info'; children: ReactNode }) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cx(
        'rounded-xl px-4 py-3 text-sm',
        tone === 'danger' && 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-200',
        tone === 'success' && 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200',
        tone === 'info' && 'bg-brand-50 text-brand-800',
      )}
    >
      {children}
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  wide = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className={cx(
          'max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-xl sm:rounded-2xl',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg',
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-canvas" aria-label="Fermer">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">{children}</div>;
}

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
          <tr>
            {head.map((cell, index) => (
              <th key={index} className="px-4 py-3 font-semibold">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-end gap-2 text-sm">
      <Button variant="secondary" size="sm" disabled={page <= 0} onClick={() => onChange(page - 1)}>
        Précédent
      </Button>
      <span className="text-muted">
        Page {page + 1} / {totalPages}
      </span>
      <Button variant="secondary" size="sm" disabled={page + 1 >= totalPages} onClick={() => onChange(page + 1)}>
        Suivant
      </Button>
    </div>
  );
}

/**
 * Official Damascino logo (wordmark, descriptor and chevron motif) followed by the programme name.
 * White version on bleu nuit, bleu nuit version on light backgrounds (charte graphique §2).
 */
export function Logo({ light = false, size = 'md' }: { light?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const height = size === 'lg' ? 'h-16' : size === 'sm' ? 'h-9' : 'h-11';
  return (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={light ? '/brand/logo-white.png' : '/brand/logo-navy.png'} alt="damascino — oriental kitchen and coffee" className={cx(height, 'w-auto')} />
      <span
        className={cx(
          'border-l pl-3 font-display text-[11px] font-semibold uppercase tracking-[0.22em]',
          light ? 'border-white/25 text-gold-400' : 'border-line text-gold-500',
        )}
      >
        Privilèges
      </span>
    </div>
  );
}

/** Chevron motif used as a band or separator (charte §6: border, band, never dominant). */
export function MotifBand({ tone = 'white', className }: { tone?: 'white' | 'navy' | 'sand'; className?: string }) {
  return <div aria-hidden="true" className={cx('motif-band', `motif-${tone}`, className)} />;
}
