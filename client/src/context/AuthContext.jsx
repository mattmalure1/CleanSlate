import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { apiUrl } from '../api';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);        // Supabase Auth user
  const [session, setSession] = useState(null);   // Supabase session (has access_token)
  const [customer, setCustomer] = useState(null); // Our customers table row
  const [loading, setLoading] = useState(true);   // True until initial session check completes

  // Fetch the linked customer profile from our backend
  const fetchCustomerProfile = useCallback(async (accessToken) => {
    try {
      const res = await fetch(apiUrl('/api/account/profile'), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCustomer(data.customer);
      } else if (res.status === 404) {
        // No linked customer yet — will be created on link-account call
        setCustomer(null);
      }
    } catch {
      setCustomer(null);
    }
  }, []);

  // Link the auth user to a customers table row (creates or matches by email)
  const linkAccount = useCallback(async (accessToken) => {
    try {
      const res = await fetch(apiUrl('/api/auth/link-account'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setCustomer(data.customer);
        return data.customer;
      }
    } catch {
      // Non-critical — profile will be available on next load
    }
    return null;
  }, []);

  // Initialize: restore session on mount
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Get current session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.access_token) {
        // Try to fetch profile; if none exists, link the account
        fetchCustomerProfile(s.access_token).then(() => {
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        setSession(s);
        setUser(s?.user ?? null);

        if (s?.access_token) {
          if (event === 'SIGNED_IN') {
            // On sign-in, link account then fetch profile
            await linkAccount(s.access_token);
          } else {
            await fetchCustomerProfile(s.access_token);
          }
        } else {
          setCustomer(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchCustomerProfile, linkAccount]);

  // Auth actions
  async function signUp({ email, password, name }) {
    if (!supabase) throw new Error('Auth not configured');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw error;
    return data;
  }

  async function signIn({ email, password }) {
    if (!supabase) throw new Error('Auth not configured');
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setCustomer(null);
  }

  async function resetPassword(email) {
    if (!supabase) throw new Error('Auth not configured');
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  }

  async function updatePassword(newPassword) {
    if (!supabase) throw new Error('Auth not configured');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  // Refresh customer profile (call after profile update)
  async function refreshProfile() {
    if (session?.access_token) {
      await fetchCustomerProfile(session.access_token);
    }
  }

  const isAdmin = !!customer?.is_admin;

  const value = {
    user,
    session,
    customer,
    loading,
    isAdmin,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
