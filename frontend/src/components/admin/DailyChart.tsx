'use client';

import { shortDate } from '@/lib/format';

interface Day {
  day: string;
  redemptions: number;
}

/** Bar chart of the number of passages per day (single series, so no legend). */
export function DailyChart({ days, from, to }: { days: Day[]; from: string; to: string }) {
  // fill the gaps so that days without passage appear as empty bars
  const byDay = new Map(days.map((d) => [d.day, d.redemptions]));
  const series: Day[] = [];
  const start = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  for (let d = start; d <= end && series.length < 400; d = new Date(d.getTime() + 86_400_000)) {
    const key = d.toISOString().slice(0, 10);
    series.push({ day: key, redemptions: byDay.get(key) ?? 0 });
  }
  const max = Math.max(1, ...series.map((d) => d.redemptions));
  const width = 100 / Math.max(series.length, 1);

  if (series.length === 0) return null;
  return (
    <figure>
      <div className="flex h-40 items-end gap-px" role="img" aria-label="Passages par jour">
        {series.map((d) => (
          <div key={d.day} className="group relative h-full flex-1" style={{ maxWidth: `${width}%` }}>
            <div
              className="absolute bottom-0 w-full rounded-t-sm bg-brand-700 transition group-hover:bg-gold-500"
              style={{ height: `${(d.redemptions / max) * 100}%`, minHeight: d.redemptions > 0 ? 2 : 0 }}
            />
            <div className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs text-canvas group-hover:block">
              {shortDate(d.day)} · {d.redemptions}
            </div>
          </div>
        ))}
      </div>
      <figcaption className="mt-2 flex justify-between text-xs text-muted">
        <span>{shortDate(series[0].day)}</span>
        <span>max {max} / jour</span>
        <span>{shortDate(series[series.length - 1].day)}</span>
      </figcaption>
    </figure>
  );
}
