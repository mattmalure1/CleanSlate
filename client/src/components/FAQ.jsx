import { ChevronDown } from 'lucide-react';

const QUESTIONS = [
  { q: 'What items do you accept?', a: 'We accept books, textbooks, DVDs, Blu-rays, CDs, and video games. Items must have a valid ISBN or UPC barcode. We do not accept VHS tapes, cassettes, vinyl records, or digital-only content.' },
  { q: 'How do I get paid?', a: 'Choose PayPal, Venmo, or check at checkout. PayPal and Venmo payments are processed within 2-3 business days after we receive and grade your items. Checks are mailed to your address.' },
  { q: 'How long does the whole process take?', a: 'After you ship your items, we typically receive them in 2-5 business days via USPS Media Mail. Grading takes 1-2 business days, and payment is sent within 24 hours of grading.' },
  { q: 'What if my item is rejected after I ship it?', a: 'If an item does not meet our condition guidelines, we will notify you by email. Unfortunately, we cannot return rejected items — they will be responsibly recycled or donated.' },
  { q: 'Do I need the original case for DVDs and games?', a: 'No! We accept discs without cases. Your offer will be adjusted down slightly to account for replacement case costs, but we still buy them.' },
  { q: 'Is shipping really free?', a: 'Yes. After checkout, we generate a prepaid USPS Media Mail shipping label that you can print or show at the post office. You pay nothing to ship.' },
  { q: 'How are your prices determined?', a: 'Our offers are based on current Amazon marketplace data including recent sale prices, demand velocity, and condition. Faster-selling items in good condition get the best offers.' },
];

export default function FAQ() {
  return (
    <section className="max-w-3xl mx-auto px-[var(--spacing-page)] py-10">
      <div className="text-center mb-8">
        <h2 className="font-display text-2xl font-bold text-text-primary">
          Frequently Asked Questions
        </h2>
      </div>

      <div className="bg-surface rounded-[var(--radius-lg)] border border-border divide-y divide-border overflow-hidden">
        {QUESTIONS.map((item, i) => (
          <details key={i} className="group">
            <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer min-h-[44px] list-none hover:bg-background/60 transition-colors [&::-webkit-details-marker]:hidden">
              <span className="font-display text-sm font-semibold text-text-primary">
                {item.q}
              </span>
              <ChevronDown
                size={18}
                className="text-text-muted flex-shrink-0 transition-transform duration-200 group-open:rotate-180"
              />
            </summary>
            <div className="px-5 pb-4 -mt-1">
              <p className="text-sm text-text-secondary leading-relaxed">
                {item.a}
              </p>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
