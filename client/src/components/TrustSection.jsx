import { Package, Zap, ShieldCheck } from 'lucide-react';

const PROPS = [
  {
    icon: Package, title: 'Free Shipping',
    desc: 'We provide a prepaid USPS Media Mail shipping label. No cost to you.',
    gradient: 'from-blue-400 to-indigo-500', shadow: 'shadow-blue-200/50',
  },
  {
    icon: Zap, title: 'Fast Payment',
    desc: 'Get paid via PayPal or Venmo within 2-3 business days of receiving your items.',
    gradient: 'from-amber-400 to-orange-500', shadow: 'shadow-amber-200/50',
  },
  {
    icon: ShieldCheck, title: 'Fair Prices',
    desc: 'Our offers are based on real market data. No lowball quotes.',
    gradient: 'from-emerald-400 to-green-500', shadow: 'shadow-emerald-200/50',
  },
];

export default function TrustSection() {
  return (
    <section className="max-w-3xl mx-auto px-[var(--spacing-page)] py-12">
      <div className="text-center mb-8">
        <h2 className="font-display text-2xl font-bold text-text-primary">
          Why CleanSlate?
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {PROPS.map((prop) => {
          const Icon = prop.icon;
          return (
            <div
              key={prop.title}
              className="bg-surface rounded-[var(--radius-lg)] border border-border p-6 text-center hover:shadow-md transition-shadow"
            >
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${prop.gradient} flex items-center justify-center mx-auto mb-4 shadow-lg ${prop.shadow}`}>
                <Icon size={28} className="text-white" strokeWidth={1.8} />
              </div>
              <h3 className="font-display text-base font-bold text-text-primary">
                {prop.title}
              </h3>
              <p className="mt-2 text-sm text-text-secondary leading-relaxed">
                {prop.desc}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
