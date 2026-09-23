'use client';

import { useState } from 'react';
import { download, errorMessage } from '@/lib/api';
import { Button } from './ui';

/** "Excel" and "CSV" download buttons for an export endpoint (query string without format). */
export function ExportButtons({ path, name, label = 'Exporter' }: { path: string; name: string; label?: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (format: 'xlsx' | 'csv') => {
    setBusy(format);
    try {
      const separator = path.includes('?') ? '&' : '?';
      await download('admin', `${path}${separator}format=${format}`, `${name}.${format}`);
    } catch (error) {
      alert(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="flex gap-2">
      <Button variant="secondary" size="sm" loading={busy === 'xlsx'} onClick={() => run('xlsx')}>
        {label} Excel
      </Button>
      <Button variant="secondary" size="sm" loading={busy === 'csv'} onClick={() => run('csv')}>
        CSV
      </Button>
    </div>
  );
}
