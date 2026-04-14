// Central API helper — adds the base URL for production
const API_BASE = import.meta.env.VITE_API_URL || '';

export function apiUrl(path) {
  return `${API_BASE}${path}`;
}

// Authenticated fetch for admin pages — auto-attaches the Supabase JWT
export async function adminFetch(path, options = {}) {
  const { supabase } = await import('./services/supabase');
  const { data } = await supabase?.auth.getSession() || {};
  const token = data?.session?.access_token;

  const headers = { ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

  return fetch(apiUrl(path), { ...options, headers });
}
