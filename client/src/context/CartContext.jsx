import { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'cleanslate_cart';
const MAX_COPIES_PER_ASIN = 5; // anti-fraud cap (also enforced server-side)

const CartContext = createContext(null);

function loadCartFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCartFromStorage);

  // Persist to localStorage whenever items change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Storage full or unavailable — silently ignore
    }
  }, [items]);

  // Returns { ok: boolean, reason?: string } so callers can show feedback
  // when an item is blocked by the per-ASIN cap.
  const addItem = useCallback((item) => {
    let result = { ok: true };
    setItems((prev) => {
      if (item.asin) {
        const sameAsinCount = prev.filter((i) => i.asin === item.asin).length;
        if (sameAsinCount >= MAX_COPIES_PER_ASIN) {
          result = {
            ok: false,
            reason: `Already ${MAX_COPIES_PER_ASIN} copies in cart — that's our per-item max.`,
          };
          return prev; // don't add
        }
      }
      return [...prev, { ...item, id: crypto.randomUUID() }];
    });
    return result;
  }, []);

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateItemCase = useCallback((id, hasCase) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, hasCase } : item))
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  // V2: separate featured (standard/low) from penny (bulk add) totals.
  // Penny items are capped at 50% of featured total.
  const featuredCents = useMemo(
    () => items.filter(i => i.tier !== 'penny').reduce((s, i) => s + (i.offerCents || 0), 0),
    [items]
  );
  const pennyRawCents = useMemo(
    () => items.filter(i => i.tier === 'penny').reduce((s, i) => s + (i.offerCents || 0), 0),
    [items]
  );
  const pennyCappedCents = useMemo(
    () => Math.min(pennyRawCents, Math.floor(featuredCents * 0.5)),
    [pennyRawCents, featuredCents]
  );
  const totalCents = featuredCents + pennyCappedCents;
  const totalDisplay = `$${(totalCents / 100).toFixed(2)}`;
  const featuredDisplay = `$${(featuredCents / 100).toFixed(2)}`;
  const pennyDisplay = `$${(pennyCappedCents / 100).toFixed(2)}`;
  const pennyCount = items.filter(i => i.tier === 'penny').length;
  const featuredCount = items.filter(i => i.tier !== 'penny').length;
  const pennyCapped = pennyRawCents > pennyCappedCents;

  const itemCount = items.length;

  const value = useMemo(
    () => ({
      items,
      addItem,
      removeItem,
      updateItemCase,
      clearCart,
      totalCents,
      totalDisplay,
      itemCount,
      // V2 tier breakdown
      featuredCents,
      featuredDisplay,
      featuredCount,
      pennyCappedCents,
      pennyDisplay,
      pennyCount,
      pennyCapped,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, addItem, removeItem, updateItemCase, clearCart, totalCents, totalDisplay, itemCount,
     featuredCents, pennyCappedCents, pennyCount, pennyCapped]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
