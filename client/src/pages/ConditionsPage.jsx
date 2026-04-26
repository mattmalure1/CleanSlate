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
      'Highlighting and underlining is fine',
      'Dust jackets in reasonable condition',
    ],
    reject: [
      'Water damage, moisture damage, or mold',
      'Major wear to the binding',
      'Large tears to the cover or pages',
      'Missing pages',
      'Strong odors (including cigarette and pet odors)',
      'Advance reader copies (ARCs) or promotional copies',
    ],
  },
  {
    id: 'discs',
    label: 'DVDs / Blu-rays / CDs',
    icon: Disc3,
    accept: [
      'Discs in New, Like New, or excellent condition',
      'Must play perfectly without skipping',
      'Original case with front and back cover artwork',
      'Multi-disc sets: all discs, case, artwork, and any inserts',
      'Light surface scratches that don\'t affect playback',
    ],
    reject: [
      'Medium or heavy scratches',
      'Discs that skip during playback',
      'Missing front or back cover artwork',
      'Ex-rental or ex-library copies',
      'Burned, pirated, or promotional copies',
      'VHS tapes or cassettes',
      'Region-locked imports (Region 1 / Region A only)',
    ],
  },
  {
    id: 'games',
    label: 'Video Games',
    icon: Gamepad2,
    accept: [
      'PlayStation, Xbox, and Nintendo games',
      'Discs in New, Like New, or excellent condition',
      'Cartridges in working condition',
      'Original case and artwork',
      'Manual included when applicable',
    ],
    reject: [
      'Downloaded or digital-only games',
      'Used PC or Mac games (sealed only)',
      'Bootleg or reproduction cartridges',
      'Damaged or non-functional media',
      'Demo discs or promotional copies',
      'Missing case or cover artwork',
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
