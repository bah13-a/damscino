'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from './api';
import type { Space } from './session';

/** Loads a GET endpoint and reloads it whenever the path changes. {@code path} null = do not load yet. */
export function useApi<T>(space: Space, path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // only the latest request may update the state: a slow earlier answer (e.g. the unfiltered list while the user
  // is typing a search) must not overwrite a newer one
  const latest = useRef(0);

  const reload = useCallback(async () => {
    if (!path) return;
    const request = ++latest.current;
    setLoading(true);
    try {
      const result = await api<T>(space, path);
      if (request !== latest.current) return;
      setData(result);
      setError(null);
    } catch (e) {
      if (request === latest.current) setError(errorMessage(e));
    } finally {
      if (request === latest.current) setLoading(false);
    }
  }, [space, path]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}

export function query(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `?${text}` : '';
}
