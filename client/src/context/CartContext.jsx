import { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'cleanslate_cart';

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

  const addItem = useCallback((item) => {
    setItems((prev) => [...prev, { ...item, id: crypto.randomUUID() }]);
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

  const totalCents = useMemo(
    () => items.reduce((sum, item) => sum + (item.offerCents || 0), 0),
    [items]
  );

  const totalDisplay = useMemo(() => {
    return `$${(totalCents / 100).toFixed(2)}`;
  }, [totalCents]);

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
    }),
    [items, addItem, removeItem, updateItemCase, clearCart, totalCents, totalDisplay, itemCount]
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
