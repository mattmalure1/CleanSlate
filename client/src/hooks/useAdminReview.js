import { useState, useCallback } from 'react';
import { adminFetch } from '../api';

export function useAdminReview() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const fetchReview = useCallback(async (code, hasCase = true) => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const cleanCode = code.replace(/[^a-zA-Z0-9]/g, '');
      const res = await adminFetch(`/api/admin/review?code=${encodeURIComponent(cleanCode)}&hasCase=${hasCase}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Review failed');
      setData(json);
      return json;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, data, error, fetchReview };
}
