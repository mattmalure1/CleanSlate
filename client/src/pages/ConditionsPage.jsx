import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, X, BookOpen, Disc3, Gamepad2 } from 'lucide-react';

const CATEGORIES = [
  {
    id: 'books',
    label: 'Books',
    icon: BookOpen,
    accept: [
      'Hardcover and paperback books with intact bindings',
      'Textbooks (current and recent editions)',
      'ISBN-barcoded books in readable condition',
      'Minimal highlighting or notes (academic books)',
      'Dust jackets in reasonable condition',
    ],
    reject: [
      'Water-damaged or moldy books',
      'Torn or missing pages',
      'Broken spines or detached covers',
      'Ex-library copies with stamps and stickers',
      'Advance reader copies (ARCs) or review copies',
      'Books with excessive writing, highlighting, or stains',
    ],
  },
  {
    id: 'discs',
    label: 'DVDs / Blu-rays / CDs',
    icon: Disc3,
    accept: [
      'DVDs, Blu-rays, and CDs with original cases',
      'Discs without deep scratches that affect playback',
      'Complete box sets with all discs',
      'Artwork inserts in good condition',
      'Discs without cases accepted at reduced value',
    ],
    reject: [
      'Cracked, warped, or heavily scratched discs',
      'Burned or pirated copies',
      'Rental or promotional copies',
      'Region-locked imports (Region 1 / Region A only)',
      'VHS tapes or cassettes',
      'Discs with missing or unreadable data layers',
    ],
  },
  {
    id: 'games',
    label: 'Video Games',
    icon: Gamepad2,
    accept: [
      'PlayStation, Xbox, and Nintendo games with cases',
      'Game cartridges in working condition',
      'Complete-in-box games (game + case + manual if applicable)',
      'Games without case accepted at reduced value',
      'Retro games (SNES, N64, GameBoy, etc.)',
    ],
    reject: [
      'Downloaded or digital-only games',
      'Bootleg or reproduction cartridges',
      'Games with damaged or non-functional media',
      'PC games with used activation keys',
      'Demo discs or promotional copies',
      'Heavily damaged cases or missing artwork',
    ],
  },
];

export default function ConditionsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('books');

  const activeCategory = CATEGORIES.find((c) => c.id === activeTab);

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

      <h1 className="font-display font-bold text-2xl text-text-primary mb-2">
        What We Accept
      </h1>
      <p className="text-text-secondary text-sm mb-6">
        Review our condition guidelines before sending items.
      </p>

      {/* Category tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeTab === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius-lg)] text-sm font-semibold whitespace-nowrap transition-all min-h-[44px] ${
                isActive
                  ? 'bg-brand-600 text-white'
                  : 'bg-surface border border-border text-text-secondary hover:border-brand-400'
              }`}
            >
              <Icon size={16} />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {activeCategory && (
        <div className="space-y-5">
          {/* Accept list */}
          <section className="bg-accept-light border border-accept/20 rounded-[var(--radius-lg)] p-4">
            <h3 className="font-display font-semibold text-base text-accept mb-3 flex items-center gap-2">
              <Check size={18} />
              We Accept
            </h3>
            <ul className="space-y-2.5">
              {activeCategory.accept.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <Check size={16} className="text-accept flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-text-primary">{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Reject list */}
          <section className="bg-reject-light border border-reject/20 rounded-[var(--radius-lg)] p-4">
            <h3 className="font-display font-semibold text-base text-reject mb-3 flex items-center gap-2">
              <X size={18} />
              We Don't Accept
            </h3>
            <ul className="space-y-2.5">
              {activeCategory.reject.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <X size={16} className="text-reject flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-text-primary">{item}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
