const TZ = 'Africa/Tunis';

const dinars = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });

/** 8 → "8 DT", 7.5 → "7,5 DT" */
export function dt(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${dinars.format(value)} DT`;
}

export function percent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${dinars.format(value)} %`;
}

export function dateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: TZ }).format(new Date(value));
}

export function longDate(value: string | null | undefined): string {
  if (!value) return '—';
  // plain ISO dates (yyyy-mm-dd) are calendar days, not instants
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: TZ }).format(date);
}

export function shortDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeZone: TZ }).format(date);
}

/** Today's date in Tunis as yyyy-mm-dd. */
export function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

export function isoDaysAgo(days: number): string {
  const date = new Date(Date.now() - days * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date);
}

/** "PLATS" → "Plats" when the label is not known. */
export function categoryLabel(code: string, labels?: Record<string, string>): string {
  if (labels?.[code]) return labels[code];
  const lower = code.toLowerCase().replace(/_/g, ' ');
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export const PERIOD_LABEL: Record<string, string> = { DAY: 'jour', WEEK: 'semaine', MONTH: 'mois' };

export function phone(value: string): string {
  return value.replace(/(\d{2})(\d{3})(\d{3})/, '$1 $2 $3');
}

/** "12:34" in Tunis time. */
export function time(value: string | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(value));
}
