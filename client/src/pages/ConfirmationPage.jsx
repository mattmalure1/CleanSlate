import { useParams, useNavigate } from 'react-router-dom';
import { apiUrl } from '../api';
import {
  CheckCircle,
  Download,
  Package,
  Truck,
  ClipboardCheck,
  DollarSign,
  ArrowRight,
  Calendar,
} from 'lucide-react';

const TIMELINE_STEPS = [
  {
    icon: Package,
    title: 'Ship Your Items',
    description: 'Pack items securely and attach the shipping label. Drop off at any USPS location.',
  },
  {
    icon: Truck,
    title: 'We Receive',
    description: 'We receive your package and log it into our system (1-3 business days).',
  },
  {
    icon: ClipboardCheck,
    title: 'We Grade',
    description: 'Our team inspects each item against our quality guidelines (1-2 business days).',
  },
  {
    icon: DollarSign,
    title: 'You Get Paid',
    description: 'Payment is sent to your chosen method within 24 hours of grading.',
  },
];

function getEstimatedPayoutDate() {
  const today = new Date();
  let businessDays = 0;
  const date = new Date(today);
  while (businessDays < 10) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) businessDays++;
  }
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function ConfirmationPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const estimatedPayout = getEstimatedPayoutDate();

  async function handleDownloadLabel() {
    try {
      const res = await fetch(apiUrl(`/api/label/${orderId}`), { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.labelUrl) throw new Error(data.error || 'Failed to get label');
      // Open the Shippo-hosted label PDF in a new tab
      window.open(data.labelUrl, '_blank');
    } catch (err) {
      alert('Could not download label. Please try again.');
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-[var(--spacing-page)] py-8">
      {/* Success header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-accept-light rounded-full mb-4">
          <CheckCircle size={36} className="text-accept" />
        </div>
        <h1 className="font-display font-bold text-2xl text-text-primary">
          You're all set!
        </h1>
        <p className="mt-2 text-text-secondary text-sm">
          Order <span className="font-mono font-semibold text-text-primary">{orderId}</span> has been submitted.
        </p>
      </div>

      {/* Download label */}
      <button
        onClick={handleDownloadLabel}
        className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-base py-4 rounded-[var(--radius-xl)] transition-all min-h-[56px] shadow-sm mb-4"
      >
        <Download size={20} />
        Download Shipping Label
      </button>
      <p className="text-center text-sm text-text-muted mb-4">
        Pack items securely, attach label, drop off at USPS.
      </p>

      {/* Estimated payout */}
      <div className="flex items-center gap-3 bg-brand-50 border border-brand-100 rounded-[var(--radius-lg)] px-4 py-3 mb-8">
        <Calendar size={18} className="text-brand-600 flex-shrink-0" />
        <p className="text-sm text-text-secondary">
          Estimated payout: <span className="font-semibold text-text-primary">{estimatedPayout}</span>
        </p>
      </div>

      {/* Timeline */}
      <section className="bg-surface rounded-[var(--radius-lg)] border border-border p-5">
        <h2 className="font-display font-semibold text-base text-text-primary mb-5">
          What happens next?
        </h2>
        <div className="space-y-0">
          {TIMELINE_STEPS.map((step, i) => {
            const Icon = step.icon;
            const isLast = i === TIMELINE_STEPS.length - 1;
            return (
              <div key={i} className="flex gap-4">
                {/* Connector line + dot */}
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                    <Icon size={18} className="text-brand-700" />
                  </div>
                  {!isLast && (
                    <div className="w-0.5 h-full bg-brand-200 min-h-[24px]" />
                  )}
                </div>
                {/* Text */}
                <div className={`pb-6 ${isLast ? 'pb-0' : ''}`}>
                  <p className="font-display font-semibold text-sm text-text-primary">
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-sm text-text-secondary leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Back to home */}
      <button
        onClick={() => navigate('/')}
        className="mt-6 w-full flex items-center justify-center gap-2 text-brand-600 hover:text-brand-700 font-semibold text-sm min-h-[44px]"
      >
        Sell more items
        <ArrowRight size={16} />
      </button>
    </div>
  );
}
