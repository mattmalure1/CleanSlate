import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, CreditCard, Mail, MapPin, CheckSquare, X } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { apiUrl } from '../api';

export default function CheckoutPage() {
  const {
    items, totalDisplay, totalCents, clearCart, removeItem,
    featuredCents, featuredDisplay, pennyCount, pennyDisplay, pennyCapped, pennyCappedCents,
  } = useCart();
  const { customer } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    zip: '',
    payoutMethod: 'paypal',
    payoutEmail: '',
  });

  // Auto-fill from customer profile when logged in
  useEffect(() => {
    if (customer) {
      const addr = customer.address || {};
      setForm((prev) => ({
        ...prev,
        name: prev.name || customer.name || '',
        email: prev.email || customer.email || '',
        phone: prev.phone || addr.phone || '',
        street: prev.street || addr.street || '',
        city: prev.city || addr.city || '',
        state: prev.state || addr.state || '',
        zip: prev.zip || addr.zip || '',
        payoutMethod: customer.payout_method || prev.payoutMethod,
        payoutEmail: prev.payoutEmail || customer.payout_details || '',
      }));
    }
  }, [customer]);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!confirmed || items.length === 0) return;

    setSubmitting(true);
    try {
      const payload = {
        items: items.map((item) => ({
          asin: item.asin,
          title: item.title,
          offerCents: item.offerCents,
          hasCase: item.hasCase,
        })),
        totalCents,
        customer: {
          name: form.name,
          email: form.email,
          phone: form.phone,
          address: {
            street: form.street,
            city: form.city,
            state: form.state,
            zip: form.zip,
          },
        },
        payout: {
          method: form.payoutMethod,
          email: form.payoutMethod !== 'check' ? form.payoutEmail : undefined,
        },
      };

      const res = await fetch(apiUrl('/api/order'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Submission failed');

      clearCart();
      navigate(`/confirmation/${data.orderId}`);
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const MIN_ORDER_CENTS = 1000; // V2: $10.00 minimum order
  const meetsMinimum = totalCents >= MIN_ORDER_CENTS;

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-[var(--spacing-page)] pt-12 text-center">
        <p className="text-text-secondary">Your cart is empty.</p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 text-brand-600 font-semibold text-sm underline min-h-[44px]"
        >
          Start scanning
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-[var(--spacing-page)] py-6">
      {/* Back */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-brand-700 mb-6 min-h-[44px]"
      >
        <ArrowLeft size={16} />
        Back to scanning
      </button>

      <h1 className="font-display font-bold text-2xl text-text-primary mb-6">
        Checkout
      </h1>

      {/* Cart summary */}
      <section className="bg-surface rounded-[var(--radius-lg)] border border-border p-4 mb-6">
        <h2 className="font-display font-semibold text-base text-text-primary mb-3">
          Your Items
        </h2>
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3">
              {item.imageUrl && (
                <img
                  src={item.imageUrl}
                  alt=""
                  className="w-12 h-12 rounded-md object-cover bg-background flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {item.title}
                </p>
              </div>
              <p className="text-sm font-bold text-brand-700">{item.offerDisplay}</p>
              <button
                onClick={() => removeItem(item.id)}
                disabled={submitting}
                className="p-1.5 text-text-muted hover:text-reject transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center rounded-md hover:bg-reject-light"
                aria-label={`Remove ${item.title}`}
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-4 pt-3 border-t border-border space-y-1">
          {pennyCount > 0 && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-accept font-medium">Featured Items</span>
                <span className="font-semibold text-text-primary">{featuredDisplay}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-amber-600 font-medium">
                  Bulk Adds ({pennyCount}){pennyCapped ? ' — capped at 50%' : ''}
                </span>
                <span className="font-semibold text-amber-600">{pennyDisplay}</span>
              </div>
              <div className="border-t border-border mt-2 pt-2" />
            </>
          )}
          <div className="flex items-center justify-between">
            <span className="font-semibold text-text-secondary">Total Payout</span>
            <span className="font-display font-bold text-xl text-text-primary">
              {totalDisplay}
            </span>
          </div>
        </div>
        {!meetsMinimum && (
          <div className="mt-3 bg-warning-light border border-warning/20 rounded-[var(--radius-md)] px-4 py-3 text-sm text-warning font-medium">
            Minimum order is $10.00 — add more items to checkout. You need ${((MIN_ORDER_CENTS - totalCents) / 100).toFixed(2)} more.
          </div>
        )}
      </section>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer info */}
        <section className="bg-surface rounded-[var(--radius-lg)] border border-border p-4">
          <h2 className="font-display font-semibold text-base text-text-primary mb-4 flex items-center gap-2">
            <MapPin size={18} className="text-brand-600" />
            Your Information
          </h2>
          <div className="space-y-3">
            <input
              type="text"
              required
              placeholder="Full name"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-border bg-background text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 min-h-[44px]"
            />
            <input
              type="email"
              required
              placeholder="Email address"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-border bg-background text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 min-h-[44px]"
            />
            <input
              type="tel"
              required
              placeholder="Phone number"
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-border bg-background text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 min-h-[44px]"
            />
            <input
              type="text"
              required
              placeholder="Street address"
              value={form.street}
              onChange={(e) => updateField('street', e.target.value)}
              className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-border bg-background text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 min-h-[44px]"
            />
            <div className="grid grid-cols-3 gap-3">
              <input
                type="text"
                required
                placeholder="City"
                value={form.city}
                onChange={(e) => updateField('city', e.target.value)}
                className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-border bg-background text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 min-h-[44px]"
              />
              <input
                type="text"
                required
                placeholder="State"
                maxLength={2}
                value={form.state}
                onChange={(e) => updateField('state', e.target.value.toUpperCase())}
                className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-border bg-background text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 min-h-[44px]"
              />
              <input
                type="text"
                required
                placeholder="ZIP"
                maxLength={5}
                value={form.zip}
                onChange={(e) => updateField('zip', e.target.value)}
                className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-border bg-background text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 min-h-[44px]"
              />
            </div>
          </div>
        </section>

        {/* Payout method */}
        <section className="bg-surface rounded-[var(--radius-lg)] border border-border p-4">
          <h2 className="font-display font-semibold text-base text-text-primary mb-4 flex items-center gap-2">
            <CreditCard size={18} className="text-brand-600" />
            Payout Method
          </h2>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {['paypal', 'venmo', 'check'].map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => { updateField('payoutMethod', method); updateField('payoutEmail', ''); }}
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
                required
                placeholder={`${form.payoutMethod === 'paypal' ? 'PayPal' : 'Venmo'} email`}
                value={form.payoutEmail}
                onChange={(e) => updateField('payoutEmail', e.target.value)}
                className="w-full px-4 py-3 rounded-[var(--radius-md)] border border-border bg-background text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 min-h-[44px]"
              />
            </div>
          )}
          {form.payoutMethod === 'check' && (
            <p className="text-sm text-text-muted">
              Check will be mailed to the address above.
            </p>
          )}
        </section>

        {/* Confirmation checkbox */}
        <label className="flex items-start gap-3 cursor-pointer min-h-[44px]">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 w-5 h-5 rounded border-border text-brand-600 focus:ring-brand-500/30 accent-brand-600"
          />
          <span className="text-sm text-text-secondary leading-snug">
            I confirm all items meet CleanSlate's condition guidelines and I am the
            rightful owner of these items.
          </span>
        </label>

        {/* Submit */}
        <button
          type="submit"
          disabled={!confirmed || !meetsMinimum || submitting}
          className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:bg-text-muted disabled:cursor-not-allowed text-white font-semibold text-base py-4 rounded-[var(--radius-xl)] transition-all min-h-[56px]"
        >
          {submitting ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <CheckSquare size={20} />
              Submit & Get Shipping Label
            </>
          )}
        </button>
      </form>
    </div>
  );
}
