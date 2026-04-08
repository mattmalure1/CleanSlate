import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Loader2,
  Package,
  Truck,
  ClipboardCheck,
  DollarSign,
  AlertCircle,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react';

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-warning-light text-warning', description: 'We are waiting to receive your package.' },
  received: { label: 'Received', color: 'bg-brand-100 text-brand-700', description: 'Your package has arrived and is in our queue.' },
  grading: { label: 'Grading', color: 'bg-brand-100 text-brand-700', description: 'Our team is inspecting your items.' },
  graded: { label: 'Graded', color: 'bg-brand-100 text-brand-700', description: 'Grading is complete. Payment is being processed.' },
  paid: { label: 'Paid', color: 'bg-accept-light text-accept', description: 'Payment has been sent to your chosen method.' },
  rejected: { label: 'Rejected', color: 'bg-reject-light text-reject', description: 'This order could not be processed.' },
};

function cents(v) {
  return `$${(v / 100).toFixed(2)}`;
}

export default function TrackPage() {
  const navigate = useNavigate();
  const [orderId, setOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = orderId.trim();
    if (!trimmed) return;

    setLoading(true);
    setError('');
    setOrder(null);

    try {
      const res = await fetch(`/api/order/${encodeURIComponent(trimmed)}`);
      if (!res.ok) {
        setError('Order not found. Check your confirmation email for the correct order ID.');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setOrder(data);
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setLoading(false);
  }

  const status = order ? STATUS_CONFIG[order.status] || STATUS_CONFIG.pending : null;

  return (
    <div className="max-w-2xl mx-auto px-[var(--spacing-page)] py-8">
      {/* Back */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-brand-700 mb-6 min-h-[44px]"
      >
        <ArrowLeft size={16} />
        Back to home
      </button>

      {/* Heading */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-100 rounded-full mb-4">
          <Package size={28} className="text-brand-700" />
        </div>
        <h1 className="font-display font-bold text-2xl text-text-primary">
          Track Your Order
        </h1>
        <p className="mt-2 text-text-secondary text-sm">
          Enter the order ID from your confirmation email to check your order status.
        </p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="flex gap-3">
          <input
            type="text"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="Enter your order ID"
            className="flex-1 px-4 py-3 rounded-[var(--radius-lg)] border border-border bg-surface text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 min-h-[48px]"
          />
          <button
            type="submit"
            disabled={loading || !orderId.trim()}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:bg-text-muted text-white font-semibold px-6 py-3 rounded-[var(--radius-lg)] transition-colors min-h-[48px]"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
            Track
          </button>
        </div>
      </form>

      {/* Error state */}
      {error && (
        <div className="bg-reject-light/50 border border-reject/10 rounded-[var(--radius-lg)] p-5 text-center">
          <AlertCircle size={28} className="text-reject mx-auto mb-2" />
          <p className="text-sm text-text-primary font-semibold mb-1">Order not found</p>
          <p className="text-sm text-text-secondary">
            {error}
          </p>
        </div>
      )}

      {/* Order details */}
      {order && status && (
        <div className="space-y-4">
          {/* Status badge */}
          <div className="bg-surface rounded-[var(--radius-lg)] border border-border p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-semibold text-base text-text-primary">
                Order Status
              </h2>
              <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${status.color}`}>
                {status.label}
              </span>
            </div>
            <p className="text-sm text-text-secondary">{status.description}</p>
            <p className="mt-3 text-xs text-text-muted font-mono">
              Order ID: {order.id}
            </p>
          </div>

          {/* Items list */}
          {order.items && order.items.length > 0 && (
            <div className="bg-surface rounded-[var(--radius-lg)] border border-border p-5">
              <h2 className="font-display font-semibold text-base text-text-primary mb-4">
                Items ({order.items.length})
              </h2>
              <div className="space-y-3">
                {order.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    {item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="w-10 h-10 rounded-md object-cover bg-background flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate">
                        {item.title}
                      </p>
                      {item.category && (
                        <span className="text-xs text-text-muted capitalize">{item.category}</span>
                      )}
                    </div>
                    <p className="text-sm font-display font-bold text-text-primary flex-shrink-0">
                      {item.offerDisplay || cents(item.offerCents || 0)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tracking number */}
          {order.trackingNumber && (
            <div className="bg-surface rounded-[var(--radius-lg)] border border-border p-5">
              <h2 className="font-display font-semibold text-base text-text-primary mb-2">
                Shipping
              </h2>
              <div className="flex items-center gap-2">
                <Truck size={16} className="text-brand-600" />
                <a
                  href={`https://tools.usps.com/go/TrackConfirmAction?tLabels=${order.trackingNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1 min-h-[44px]"
                >
                  {order.trackingNumber}
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>
          )}

          {/* Payout estimate */}
          {order.estimatedPayoutDate && (
            <div className="bg-brand-50/50 rounded-[var(--radius-lg)] border border-brand-200/50 p-5">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign size={16} className="text-brand-600" />
                <h2 className="font-display font-semibold text-base text-text-primary">
                  Estimated Payout
                </h2>
              </div>
              <p className="text-sm text-text-secondary">
                Your payment is estimated by{' '}
                <span className="font-semibold text-text-primary">
                  {new Date(order.estimatedPayoutDate).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
