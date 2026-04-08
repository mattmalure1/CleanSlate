import { ScanBarcode, DollarSign, Truck, Wallet } from 'lucide-react';

const STEPS = [
  { icon: ScanBarcode, title: 'Scan or Search', desc: 'Enter an ISBN, scan a barcode, or search by title', gradient: 'from-blue-400 to-cyan-500', shadow: 'shadow-blue-200/50' },
  { icon: DollarSign, title: 'Get Instant Offer', desc: 'See your offer in seconds with no obligation', gradient: 'from-emerald-400 to-green-500', shadow: 'shadow-emerald-200/50' },
  { icon: Truck, title: 'Ship for Free', desc: 'Print your prepaid USPS Media Mail label', gradient: 'from-brand-400 to-brand-600', shadow: 'shadow-brand-200/50' },
  { icon: Wallet, title: 'Get Paid', desc: 'Receive payment via PayPal, Venmo, or check', gradient: 'from-amber-400 to-orange-500', shadow: 'shadow-amber-200/50' },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="max-w-3xl mx-auto px-[var(--spacing-page)] py-12">
      <div className="text-center mb-10">
        <h2 className="font-display text-2xl font-bold text-text-primary">
          How It Works
        </h2>
        <p className="mt-2 text-sm text-text-secondary">
          Four simple steps to turn your shelf into cash
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={step.title} className="relative flex flex-col items-center text-center">
              {/* Connecting line on desktop */}
              {i < STEPS.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-[calc(50%+36px)] w-[calc(100%-72px)] h-px bg-border" />
              )}

              {/* Icon container */}
              <div className="relative mb-4">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.gradient} flex items-center justify-center shadow-lg ${step.shadow}`}>
                  <Icon size={30} className="text-white" strokeWidth={1.8} />
                </div>
                <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-text-primary text-white text-xs font-bold flex items-center justify-center shadow">
                  {i + 1}
                </span>
              </div>

              <h3 className="font-display text-sm font-bold text-text-primary">
                {step.title}
              </h3>
              <p className="mt-1.5 text-xs text-text-secondary leading-relaxed max-w-[160px]">
                {step.desc}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
