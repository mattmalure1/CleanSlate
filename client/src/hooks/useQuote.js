import { useState, useCallback } from 'react';
import { apiUrl } from '../api';

export function useQuote() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const fetchQuote = useCallback(async (code, hasCase = true) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(apiUrl(`/api/quote?code=${encodeURIComponent(code)}&hasCase=${hasCase}`));
      const data = await res.json();
      if (!res.ok) {
        // 404 = item not found — show as a rejected result, not a generic error
        if (res.status === 404) {
          setResult({ status: 'rejected', color: 'red', message: data.error || "We couldn't find this item. Try a different barcode or search term.", title: null, offerCents: 0, offerDisplay: '$0.00' });
          return;
        }
        throw new Error(data.error || data.message || 'Failed to get quote');
      }
      setResult(data);
      return data;
    } catch (err) {
      setError(err.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const requote = useCallback(async (code, hasCase) => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/requote?code=${encodeURIComponent(code)}&hasCase=${hasCase}`));
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to requote');
      setResult(data);
      return data;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, result, error, fetchQuote, requote, setResult };
}
