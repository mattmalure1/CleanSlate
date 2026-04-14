import { useState, useCallback } from 'react';
import { apiUrl } from '../api';

export function useDebugQuote() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const analyze = useCallback(async (code, { forceRefresh = false } = {}) => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const cleanCode = code.replace(/[^a-zA-Z0-9]/g, '');
      if (!cleanCode) throw new Error('Enter a UPC or ASIN');
      const url = apiUrl(
        `/api/admin/debug-quote?code=${encodeURIComponent(cleanCode)}${forceRefresh ? '&forceRefresh=true' : ''}`,
      );
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
      setData(json);
      return json;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, data, error, analyze, clear: () => { setData(null); setError(null); } };
}
