import { useState } from 'react';
import {
  ShoppingCart,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Disc3,
  ChevronDown,
  Info,
} from 'lucide-react';
import { useCart } from '../context/CartContext';

export default function QuoteCard({ data, onCaseToggle }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const [showWhy, setShowWhy] = useState(false);

  if (!data) return null;

  const {
    asin,
    title,
    imageUrl,
    category,
    offerCents,
    offerDisplay,
    status,
    message,
    isDisc,
    hasCase,
    color,
    label,
  } = data;

  const isAccepted = status === 'accepted';
  const isLow = status === 'low';
  const isRejected = status === 'rejected';

  const statusStyles = isAccepted
    ? 'bg-accept-light border-accept/20'
    : isLow
      ? 'bg-warning-light border-warning/20'
      : 'bg-reject-light border-reject/20';

  function handleAdd() {
    addItem({
      asin,
      title,
      imageUrl,
      offerCents,
      offerDisplay,
      category,
      isDisc,
      hasCase,
      color,
      label,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div
      className={`rounded-[var(--radius-lg)] border p-4 sm:p-5 ${statusStyles}`}
      style={{ animation: 'fadeSlideUp 0.35s ease-out' }}
    >
      <div className="flex gap-4">
        {imageUrl && (
          <img
            src={imageUrl}
            alt=""
            className="w-24 h-24 rounded-[var(--radius-md)] object-cover bg-background flex-shrink-0"
          />
        )}

        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-text-primary leading-snug line-clamp-2">
            {title}
          </p>
          {category && (
            <span className="inline-block mt-1.5 text-xs font-medium text-text-muted bg-background/60 px-2.5 py-0.5 rounded-full capitalize">
              {category}
            </span>
          )}

          <div className="mt-3">
            {isRejected ? (
              <div className="flex items-center gap-1.5 text-reject">
                <XCircle size={18} />
                <span className="text-sm font-semibold">Can't make an offer</span>
              </div>
            ) : isLow ? (
              <>
                <p className="text-2xl font-bold font-display text-text-primary">{offerDisplay}</p>
                <div className="mt-1 flex items-center gap-1.5 text-warning text-sm">
                  <AlertTriangle size={15} />
                  <span className="font-medium">Low offer — still interested?</span>
                </div>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold font-display text-text-primary">{offerDisplay}</p>
                <div className="mt-1 flex items-center gap-1.5 text-accept text-sm">
                  <CheckCircle2 size={15} />
                  <span className="font-medium">We'll buy this!</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {message && isRejected && (
        <p className="mt-3 text-sm text-reject/80">{message}</p>
      )}

      {/* Disc case toggle */}
      {isDisc && !isRejected && (
        <div className="mt-4 flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-text-secondary">
            <Disc3 size={16} />
            <span>Original case?</span>
          </div>
          <div className="flex rounded-[var(--radius-md)] overflow-hidden border border-border">
            <button
              onClick={() => onCaseToggle?.(true)}
              className={`px-5 py-2 text-sm font-medium min-h-[44px] cursor-pointer ${
                hasCase ? 'bg-brand-600 text-white' : 'bg-surface text-text-secondary hover:bg-background'
              }`}
            >
              Yes
            </button>
            <button
              onClick={() => onCaseToggle?.(false)}
              className={`px-5 py-2 text-sm font-medium min-h-[44px] cursor-pointer ${
                !hasCase ? 'bg-brand-600 text-white' : 'bg-surface text-text-secondary hover:bg-background'
              }`}
            >
              No
            </button>
          </div>
        </div>
      )}

      {/* Add to Cart */}
      {!isRejected && offerCents > 0 && (
        <button
          onClick={handleAdd}
          disabled={added}
          className={`mt-4 w-full flex items-center justify-center gap-2 font-semibold text-sm py-3.5 rounded-[var(--radius-md)] min-h-[52px] cursor-pointer ${
            added ? 'bg-accept text-white' : 'bg-brand-600 hover:bg-brand-700 text-white active:scale-[0.97]'
          }`}
        >
          <ShoppingCart size={18} />
          {added ? 'Added to Cart' : 'Add to Cart'}
        </button>
      )}

      {/* Why this price? */}
      {!isRejected && offerCents > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowWhy(!showWhy)}
            className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary min-h-[44px] cursor-pointer"
          >
            <Info size={14} />
            <span>Why this price?</span>
            <ChevronDown size={14} className={`${showWhy ? 'rotate-180' : ''}`} />
          </button>
          {showWhy && (
            <p className="mt-1 text-xs text-text-muted leading-relaxed pl-5">
              Based on current Amazon used market prices, selling speed, and competition.
              Items are quoted in "Good" condition. If your item is in better condition,
              you may receive a higher payout after we inspect it.
            </p>
          )}
        </div>
      )}

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
