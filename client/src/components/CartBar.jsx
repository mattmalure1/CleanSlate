import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, ChevronUp, ChevronDown, X, ArrowRight } from 'lucide-react';
import { useCart } from '../context/CartContext';

export default function CartBar() {
  const { items, itemCount, totalDisplay, totalCents, removeItem } = useCart();
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  if (itemCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      {/* Expanded item list */}
      {expanded && (
        <div
          className="bg-surface border-t border-border max-h-64 overflow-y-auto shadow-lg animate-slideUp"
          style={{ animation: 'slideUp 0.25s ease-out' }}
        >
          <div className="max-w-2xl mx-auto px-[var(--spacing-page)] py-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-text-secondary">Your Items</p>
              <button
                onClick={() => setExpanded(false)}
                className="p-1 text-text-muted hover:text-text-primary min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Collapse cart"
              >
                <ChevronDown size={20} />
              </button>
            </div>
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="w-10 h-10 rounded-md object-cover bg-background flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{item.title}</p>
                    <p className="text-sm font-semibold text-brand-700">{item.offerDisplay}</p>
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-2 text-text-muted hover:text-reject transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                    aria-label={`Remove ${item.title}`}
                  >
                    <X size={18} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <div className="bg-surface border-t border-border shadow-lg">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-[var(--spacing-page)] h-16">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 min-h-[44px] min-w-[44px] px-2"
            aria-label="Toggle cart details"
          >
            <div className="relative">
              <ShoppingCart size={22} className="text-brand-700" />
              <span className="absolute -top-1.5 -right-2 bg-brand-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {itemCount}
              </span>
            </div>
            <span className="text-sm font-medium text-text-secondary ml-1">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </span>
            {expanded ? <ChevronDown size={16} className="text-text-muted" /> : <ChevronUp size={16} className="text-text-muted" />}
          </button>

          <p className="text-lg font-bold font-display text-text-primary">{totalDisplay}</p>

          {totalCents < 800 ? (
            <span className="text-xs text-warning font-semibold px-3">
              ${((800 - totalCents) / 100).toFixed(2)} more to checkout
            </span>
          ) : (
            <button
              onClick={() => {
                setExpanded(false);
                navigate('/checkout');
              }}
              className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm px-5 py-2.5 rounded-[var(--radius-lg)] transition-colors min-h-[44px] cursor-pointer"
            >
              Get Paid
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
