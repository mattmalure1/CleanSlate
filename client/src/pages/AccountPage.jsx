import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Package, User, Settings, LogOut, Loader2, ChevronDown, ChevronUp,
  Download, Truck, ExternalLink, Save, Lock, Mail, MapPin, CreditCard,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiUrl } from '../api';

const STATUS_BADGES = {
  pending: { label: 'Pending', cls: 'bg-warning-light text-warning' },
  label_created: { label: 'Label Created', cls: 'bg-brand-100 text-brand-700' },
  shipped: { label: 'Shipped', cls: 'bg-brand-100 text-brand-700' },
  received: { label: 'Received', cls: 'bg-brand-100 text-brand-700' },
  grading: { label: 'Grading', cls: 'bg-brand-100 text-brand-700' },
  graded: { label: 'Graded', cls: 'bg-brand-100 text-brand-700' },
  paid: { label: 'Paid', cls: 'bg-accept-light text-accept' },
  cancelled: { label: 'Cancelled', cls: 'bg-reject-light text-reject' },
};

function cents(v) {
  return `$${(v / 100).toFixed(2)}`;
}

// ── Orders Tab ──────────────────────────────────────────────────
function OrdersTab({ session }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(apiUrl('/api/account/orders'), {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setOrders(data.orders || []);
        }
      } catch { /* ignore */ }
      setLoading(false);
    }
    load();
  }, [session]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-brand-600" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-12">
        <Package size={40} className="text-text-muted mx-auto mb-3" />
        <p className="text-text-secondary text-sm">No orders yet.</p>
        <Link
          to="/"
          className="inline-block mt-3 text-brand-600 hover:text-brand-700 font-semibold text-sm"
        >
          Start scanning items to sell
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => {
        const badge = STATUS_BADGES[order.status] || STATUS_BADGES.pending;
        const isOpen = expanded === order.id;

        return (
          <div key={order.id} className="bg-surface rounded-[var(--radius-lg)] border border-border overflow-hidden">
            {/* Order header — clickable */}
            <button
              onClick={() => setExpanded(isOpen ? null : order.id)}
              className="w-full flex items-center justify-between px-4 py-4 text-left min-h-[56px]"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-semibold text-text-primary">{order.id}</span>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>
                <p className="text-xs text-text-muted mt-1">
                  {new Date(order.created_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                  {' · '}
                  {order.item_count} item{order.item_count !== 1 ? 's' : ''}
                  {' · '}
                  {cents(order.total_offer_cents)}
                </p>
              </div>
              {isOpen ? <ChevronUp size={18} className="text-text-muted" /> : <ChevronDown size={18} className="text-text-muted" />}
            </button>

            {/* Expanded details */}
            {isOpen && (
              <div className="border-t border-border px-4 py-4 space-y-4">
                {/* Items */}
                {order.items && order.items.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Items</h4>
                    <div className="space-y-2">
                      {order.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-sm text-text-primary truncate flex-1 mr-3">{item.title}</span>
                          <span className="text-sm font-semibold text-text-primary flex-shrink-0">{cents(item.offered_price_cents)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tracking */}
                {order.tracking_number && (
                  <div className="flex items-center gap-2">
                    <Truck size={14} className="text-brand-600" />
                    <a
                      href={`https://tools.usps.com/go/TrackConfirmAction?tLabels=${order.tracking_number}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
                    >
                      {order.tracking_number}
                      <ExternalLink size={12} />
                    </a>
                  </div>
                )}

                {/* Label download */}
                {order.label_url && (
                  <a
                    href={order.label_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium"
                  >
                    <Download size={14} />
                    Download Shipping Label
                  </a>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Profile Tab ─────────────────────────────────────────────────
function ProfileTab({ session, customer, refreshProfile }) {
  const [form, setForm] = useState({
    name: '',
    street: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
    payoutMethod: 'paypal',
    payoutEmail: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Populate form from customer profile
  useEffect(() => {
    if (customer) {
      const addr = customer.address || {};
      setForm({
        name: customer.name || '',
        street: addr.street || '',
        city: addr.city || '',
        state: addr.state || '',
        zip: addr.zip || '',
        phone: addr.phone || '',
        payoutMethod: customer.payout_method || 'paypal',
        payoutEmail: customer.payout_details || '',
      });
    }
  }, [customer]);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const res = await fetch(apiUrl('/api/account/profile'), {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: form.name,
          address: {
            street: form.street,
            city: form.city,
            state: form.state,
            zip: form.zip,
            phone: form.phone,
          },
          payoutMethod: form.payoutMethod,
          payoutDetails: form.payoutMethod !== 'check' ? form.payoutEmail : '',
        }),
      });

      if (!res.ok) throw new Error('Failed to save profile');
      await refreshProfile();
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {/* Personal info */}
      <div className="bg-surface rounded-[var(--radius-lg)] border border-border p-5">
        <h3 className="font-display font-semibold text-base text-text-primary mb-4 flex items-center gap-2">
          <User size={18} className="text-brand-600" />
          Personal Info
        </h3>
        <div className="space-y-3">
          <input
            type="text"
            required
            placeholder="Full name"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-border bg-background text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 min-h-[44px]"
          />
          <input
            type="tel"
            placeholder="Phone number"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-border bg-background text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 min-h-[44px]"
          />
        </div>
      </div>

      {/* Address */}
      <div className="bg-surface rounded-[var(--radius-lg)] border border-border p-5">
        <h3 className="font-display font-semibold text-base text-text-primary mb-4 flex items-center gap-2">
          <MapPin size={18} className="text-brand-600" />
          Shipping Address
        </h3>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Street address"
            value={form.street}
            onChange={(e) => update('street', e.target.value)}
            className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-border bg-background text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 min-h-[44px]"
          />
          <div className="grid grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="City"
              value={form.city}
              onChange={(e) => update('city', e.target.value)}
              className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-border bg-background text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 min-h-[44px]"
            />
            <input
              type="text"
              placeholder="State"
              maxLength={2}
              value={form.state}
              onChange={(e) => update('state', e.target.value.toUpperCase())}
              className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-border bg-background text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 min-h-[44px]"
            />
            <input
              type="text"
              placeholder="ZIP"
              maxLength={5}
              value={form.zip}
              onChange={(e) => update('zip', e.target.value)}
              className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-border bg-background text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 min-h-[44px]"
            />
          </div>
        </div>
      </div>

      {/* Payout */}
      <div className="bg-surface rounded-[var(--radius-lg)] border border-border p-5">
        <h3 className="font-display font-semibold text-base text-text-primary mb-4 flex items-center gap-2">
          <CreditCard size={18} className="text-brand-600" />
          Payout Method
        </h3>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {['paypal', 'venmo', 'check'].map((method) => (
            <button
              key={method}
              type="button"
              onClick={() => { update('payoutMethod', method); update('payoutEmail', ''); }}
              className={`py-3 rounded-[var(--radius-md)] text-sm font-semibold capitalize transition-all min-h-[48px] ${
                form.payoutMethod === method
                  ? 'bg-brand-600 text-white'
                  : 'bg-background border border-border text-text-secondary hover:border-brand-400'
              }`}
            >
              {method}
            </button>
          ))}
        </div>
        {form.payoutMethod !== 'check' && (
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-text-muted flex-shrink-0" />
            <input
              type="email"
              placeholder={`${form.payoutMethod === 'paypal' ? 'PayPal' : 'Venmo'} email`}
              value={form.payoutEmail}
              onChange={(e) => update('payoutEmail', e.target.value)}
              className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-border bg-background text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 min-h-[44px]"
            />
          </div>
        )}
      </div>

      {error && (
        <div className="bg-reject-light/50 border border-reject/10 rounded-[var(--radius-md)] px-4 py-3 text-sm text-reject font-medium">
          {error}
        </div>
      )}

      {saved && (
        <div className="bg-accept-light/50 border border-accept/10 rounded-[var(--radius-md)] px-4 py-3 text-sm text-accept font-medium">
          Profile saved!
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:bg-text-muted disabled:cursor-not-allowed text-white font-semibold text-base py-4 rounded-[var(--radius-xl)] transition-all min-h-[56px]"
      >
        {saving ? (
          <><Loader2 size={20} className="animate-spin" /> Saving...</>
        ) : (
          <><Save size={20} /> Save Profile</>
        )}
      </button>
    </form>
  );
}

// ── Settings Tab ────────────────────────────────────────────────
function SettingsTab({ user, signOut }) {
  const navigate = useNavigate();
  const { updatePassword } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function handleChangePassword(e) {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await updatePassword(newPassword);
      setSaved(true);
      setNewPassword('');
    } catch (err) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <div className="space-y-4">
      {/* Email (read-only) */}
      <div className="bg-surface rounded-[var(--radius-lg)] border border-border p-5">
        <h3 className="font-display font-semibold text-base text-text-primary mb-2">Email</h3>
        <p className="text-sm text-text-secondary">{user.email}</p>
      </div>

      {/* Change password */}
      <form onSubmit={handleChangePassword} className="bg-surface rounded-[var(--radius-lg)] border border-border p-5">
        <h3 className="font-display font-semibold text-base text-text-primary mb-4 flex items-center gap-2">
          <Lock size={18} className="text-brand-600" />
          Change Password
        </h3>
        <div className="space-y-3">
          <input
            type="password"
            minLength={6}
            value={newPassword}
            onChange={(e) => { setNewPassword(e.target.value); setSaved(false); }}
            placeholder="New password (min 6 characters)"
            className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-border bg-background text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 min-h-[44px]"
          />
          {error && <p className="text-sm text-reject font-medium">{error}</p>}
          {saved && <p className="text-sm text-accept font-medium">Password updated!</p>}
          <button
            type="submit"
            disabled={saving || !newPassword}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:bg-text-muted disabled:cursor-not-allowed text-white font-semibold text-sm px-5 py-2.5 rounded-[var(--radius-lg)] transition-all min-h-[44px]"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
            Update Password
          </button>
        </div>
      </form>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        className="w-full flex items-center justify-center gap-2 border border-reject/20 text-reject hover:bg-reject-light font-semibold text-sm py-3 rounded-[var(--radius-lg)] transition-all min-h-[48px]"
      >
        <LogOut size={18} />
        Sign Out
      </button>
    </div>
  );
}

// ── Main Account Page ───────────────────────────────────────────
const TABS = [
  { id: 'orders', label: 'Orders', icon: Package },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function AccountPage() {
  const navigate = useNavigate();
  const { user, session, customer, loading, signOut, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('orders');

  // Redirect to login if not authenticated
  if (!loading && !user) {
    navigate('/login', { replace: true });
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-[var(--spacing-page)] py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl text-text-primary">
          My Account
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Welcome back{customer?.name ? `, ${customer.name.split(' ')[0]}` : ''}
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-background rounded-[var(--radius-lg)] p-1 mb-6 border border-border">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold py-2.5 rounded-[var(--radius-md)] transition-all min-h-[44px] ${
              activeTab === id
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-text-secondary hover:text-brand-700 hover:bg-brand-50'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'orders' && <OrdersTab session={session} />}
      {activeTab === 'profile' && (
        <ProfileTab session={session} customer={customer} refreshProfile={refreshProfile} />
      )}
      {activeTab === 'settings' && (
        <SettingsTab user={user} signOut={signOut} />
      )}
    </div>
  );
}
