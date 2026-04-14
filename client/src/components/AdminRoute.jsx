import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AdminRoute({ children }) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-brand-600" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto px-[var(--spacing-page)] py-20 text-center">
        <h1 className="font-display font-bold text-2xl text-text-primary mb-2">Access Denied</h1>
        <p className="text-text-secondary text-sm">This page is restricted to administrators.</p>
      </div>
    );
  }

  return children;
}
