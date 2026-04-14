import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Mail, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="max-w-md mx-auto px-[var(--spacing-page)] py-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-accept-light rounded-full mb-4">
          <Mail size={32} className="text-accept" />
        </div>
        <h1 className="font-display font-bold text-2xl text-text-primary mb-2">
          Check your email
        </h1>
        <p className="text-text-secondary text-sm leading-relaxed mb-6">
          If an account exists for <span className="font-semibold text-text-primary">{email}</span>,
          we sent a password reset link.
        </p>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm px-6 py-3 rounded-[var(--radius-lg)] transition-all min-h-[44px]"
        >
          Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-[var(--spacing-page)] py-8">
      <button
        onClick={() => navigate('/login')}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-brand-700 mb-6 min-h-[44px]"
      >
        <ArrowLeft size={16} />
        Back to sign in
      </button>

      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-100 rounded-full mb-4">
          <KeyRound size={28} className="text-brand-700" />
        </div>
        <h1 className="font-display font-bold text-2xl text-text-primary">
          Reset Password
        </h1>
        <p className="mt-2 text-text-secondary text-sm">
          Enter your email and we'll send you a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-surface rounded-[var(--radius-lg)] border border-border p-5">
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            Email
          </label>
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full pl-10 pr-4 py-3 rounded-[var(--radius-md)] border border-border bg-background text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 min-h-[44px]"
            />
          </div>
        </div>

        {error && (
          <div className="bg-reject-light/50 border border-reject/10 rounded-[var(--radius-md)] px-4 py-3 text-sm text-reject font-medium">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:bg-text-muted disabled:cursor-not-allowed text-white font-semibold text-base py-4 rounded-[var(--radius-xl)] transition-all min-h-[56px]"
        >
          {loading ? (
            <><Loader2 size={20} className="animate-spin" /> Sending...</>
          ) : (
            'Send Reset Link'
          )}
        </button>
      </form>
    </div>
  );
}
