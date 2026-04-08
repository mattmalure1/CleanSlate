import { Link } from 'react-router-dom';
import { BookOpen, Disc3, Music, Gamepad2, ChevronRight } from 'lucide-react';

const CATEGORIES = [
  {
    icon: BookOpen, title: 'Books & Textbooks',
    items: ['Hardcover & paperback', 'Current edition textbooks', 'ISBN-barcoded books'],
    gradient: 'from-amber-400 to-orange-500', shadow: 'shadow-amber-200/50', dot: 'bg-amber-400',
  },
  {
    icon: Disc3, title: 'DVDs & Blu-rays',
    items: ['Movies & TV series', 'Box sets welcome', 'With or without case'],
    gradient: 'from-purple-400 to-indigo-500', shadow: 'shadow-purple-200/50', dot: 'bg-purple-400',
  },
  {
    icon: Music, title: 'CDs',
    items: ['Music albums', 'Box sets welcome', 'With or without case'],
    gradient: 'from-rose-400 to-pink-500', shadow: 'shadow-rose-200/50', dot: 'bg-rose-400',
  },
  {
    icon: Gamepad2, title: 'Video Games',
    items: ['PlayStation, Xbox, Nintendo', 'Cartridges & discs', 'With or without case'],
    gradient: 'from-emerald-400 to-teal-500', shadow: 'shadow-emerald-200/50', dot: 'bg-emerald-400',
  },
];

export default function CategoryShowcase() {
  return (
    <section className="max-w-3xl mx-auto px-[var(--spacing-page)] py-12">
      <div className="text-center mb-8">
        <h2 className="font-display text-2xl font-bold text-text-primary">
          What We Buy
        </h2>
        <p className="mt-2 text-sm text-text-secondary">We accept all major media formats</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <Link
              key={cat.title}
              to="/conditions"
              className="bg-surface rounded-[var(--radius-lg)] border border-border p-5 hover:border-brand-300 hover:shadow-md transition-all group"
            >
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${cat.gradient} flex items-center justify-center mb-4 shadow-lg ${cat.shadow} group-hover:scale-105 transition-transform`}>
                <Icon size={28} className="text-white" strokeWidth={1.8} />
              </div>

              <h3 className="font-display text-sm font-semibold text-text-primary mb-2">
                {cat.title}
              </h3>

              <ul className="space-y-1.5">
                {cat.items.map((item) => (
                  <li key={item} className="text-xs text-text-secondary leading-relaxed flex items-start gap-1.5">
                    <span className={`mt-1.5 w-1 h-1 rounded-full ${cat.dot} flex-shrink-0`} />
                    {item}
                  </li>
                ))}
              </ul>

              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand-600 group-hover:text-brand-700 transition-colors">
                See conditions
                <ChevronRight size={12} />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
