import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, UserPlus, Mail, Lock, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { signUp, user } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Redirect if already logged in
  if (user) {
    navigate('/account', { replace: true });
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      await signUp({ email, password, name });
      setSuccess(true);
    } catch (err) {
      setError(
        err.message?.includes('already registered')
          ? 'An account with this email already exists. Try signing in.'
          : err.message || 'Something went wrong. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto px-[var(--spacing-page)] py-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-accept-light rounded-full mb-4">
            <Mail size={32} className="text-accept" />
          </div>
          <h1 className="font-display font-bold text-2xl text-text-primary mb-2">
            Check your email
          </h1>
          <p className="text-text-secondary text-sm leading-relaxed mb-6">
            We sent a verification link to <span className="font-semibold text-text-primary">{email}</span>.
            Click the link to activate your account, then come back and sign in.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm px-6 py-3 rounded-[var(--radius-lg)] transition-all min-h-[44px]"
          >
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-[var(--spacing-page)] py-8">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-brand-700 mb-6 min-h-[44px]"
      >
        <ArrowLeft size={16} />
        Back to home
      </button>

      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-100 rounded-full mb-4">
          <UserPlus size={28} className="text-brand-700" />
        </div>
        <h1 className="font-display font-bold text-2xl text-text-primary">
          Create Account
        </h1>
        <p className="mt-2 text-text-secondary text-sm">
          Track your orders, save your info, and get paid faster.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-surface rounded-[var(--radius-lg)] border border-border p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="w-full pl-10 pr-4 py-3 rounded-[var(--radius-md)] border border-border bg-background text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 min-h-[44px]"
              />
            </div>
          </div>

          <div>
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

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full pl-10 pr-4 py-3 rounded-[var(--radius-md)] border border-border bg-background text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 min-h-[44px]"
              />
            </div>
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
            <><Loader2 size={20} className="animate-spin" /> Creating account...</>
          ) : (
            <><UserPlus size={20} /> Create Account</>
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-text-secondary">
        Already have an account?{' '}
        <Link to="/login" className="text-brand-600 hover:text-brand-700 font-semibold">
          Sign in
        </Link>
      </p>
    </div>
  );
}
