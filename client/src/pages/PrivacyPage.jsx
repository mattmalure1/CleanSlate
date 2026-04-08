import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

const SECTIONS = [
  {
    title: 'Information We Collect',
    content: `When you use CleanSlate, we collect the following information to process your orders:

- Full name and email address
- Shipping address (for generating prepaid shipping labels)
- Payout details (PayPal email, Venmo handle, or Zelle phone/email)
- Order details including item barcodes, titles, and condition assessments
- Device information such as browser type and IP address (collected automatically for security purposes)`,
  },
  {
    title: 'How We Use Your Information',
    content: `We use the information we collect for the following purposes:

- Processing and fulfilling your buyback orders
- Generating prepaid shipping labels through our shipping partner
- Sending payment to your chosen payout method
- Communicating order status updates via email
- Improving our service and pricing accuracy
- Preventing fraud and ensuring the security of our platform`,
  },
  {
    title: 'Third-Party Services',
    content: `We work with trusted third-party services to operate CleanSlate:

- Supabase: Secure cloud database for storing order and account data
- Shippo: Shipping label generation and tracking services
- PayPal / Venmo: Payment processing for order payouts
- Keepa: Product data and pricing information (no personal data shared)

These services have their own privacy policies and we encourage you to review them. We only share the minimum information necessary for each service to function.`,
  },
  {
    title: 'Data Retention',
    content: `We retain order records and associated personal information for as long as necessary to fulfill our business and legal obligations. This includes maintaining records for tax reporting, dispute resolution, and customer service purposes.

If you would like to request deletion of your personal data, please contact us at support@cleanslatemedia.com. We will process your request within 30 days, subject to any legal obligations requiring us to retain certain records.`,
  },
  {
    title: 'Cookies & Local Storage',
    content: `CleanSlate uses minimal browser storage:

- localStorage: We store your cart contents locally in your browser so items persist between visits. This data never leaves your device until you submit an order.
- We do not use tracking cookies, advertising pixels, or third-party analytics tools.`,
  },
  {
    title: 'Data Security',
    content: `We take reasonable measures to protect your personal information, including:

- Encrypted data transmission (HTTPS/TLS) for all communications
- Secure cloud infrastructure with access controls
- Limited employee access to personal data on a need-to-know basis

No method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.`,
  },
  {
    title: 'Your Rights',
    content: `You have the right to:

- Request access to the personal data we hold about you
- Request correction of inaccurate information
- Request deletion of your personal data
- Opt out of promotional communications

To exercise any of these rights, contact us at support@cleanslatemedia.com.`,
  },
  {
    title: 'Changes to This Policy',
    content: `We may update this Privacy Policy from time to time. When we make changes, we will update the "Last updated" date at the top of this page. We encourage you to review this page periodically.`,
  },
  {
    title: 'Contact Us',
    content: `If you have any questions or concerns about this Privacy Policy or our data practices, please contact us:

Email: support@cleanslatemedia.com`,
  },
];

export default function PrivacyPage() {
  const navigate = useNavigate();

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

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <Shield size={24} className="text-brand-600" />
          <h1 className="font-display font-bold text-2xl text-text-primary">
            Privacy Policy
          </h1>
        </div>
        <p className="text-sm text-text-muted">
          Last updated: April 7, 2026
        </p>
        <p className="mt-3 text-sm text-text-secondary leading-relaxed">
          CleanSlate Media ("we", "our", "us") is committed to protecting your privacy.
          This Privacy Policy explains how we collect, use, and safeguard your personal
          information when you use our media buyback service.
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-8">
        {SECTIONS.map((section, i) => (
          <section key={i}>
            <h2 className="font-display font-semibold text-lg text-text-primary mb-3">
              {i + 1}. {section.title}
            </h2>
            <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
              {section.content}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
