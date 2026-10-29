import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Book } from '../types';

export interface CartBookSnapshot {
  id: string;
  slug: string;
  title: string;
  author: string;
  price: number;
  edition: string;
  format: Book['format'];
  coverPalette: Book['coverPalette'];
}

export interface CartLine {
  book: CartBookSnapshot;
  quantity: number;
}

interface CartContextValue {
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
  addItem: (book: CartBookSnapshot, quantity?: number) => void;
  updateQuantity: (bookId: string, quantity: number) => void;
  removeItem: (bookId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = 'nightingale-cart-v2';
/** Matches the server's per-title limit (MAX_QUANTITY_PER_TITLE in server/src/modules/pricing.ts). */
export const MAX_QUANTITY_PER_TITLE = 20;

/** Drops anything in storage that isn't a well-formed line (old format, hand-edited, corrupted). */
function isCartLine(value: unknown): value is CartLine {
  const line = value as CartLine;
  return (
    typeof line === 'object' &&
    line !== null &&
    Number.isInteger(line.quantity) &&
    line.quantity > 0 &&
    typeof line.book?.id === 'string' &&
    typeof line.book.price === 'number'
  );
}

export function snapshotFromBook(book: Book): CartBookSnapshot {
  return {
    id: book.id,
    slug: book.slug,
    title: book.title,
    author: book.author,
    price: book.price,
    edition: book.edition,
    format: book.format,
    coverPalette: book.coverPalette,
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(isCartLine) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // Storage full or blocked (private mode): the cart still works for this visit.
    }
  }, [lines]);

  function addItem(book: CartBookSnapshot, quantity = 1) {
    setLines((current) => {
      const existing = current.find((line) => line.book.id === book.id);
      if (existing) {
        return current.map((line) =>
          line.book.id === book.id ? { ...line, quantity: Math.min(line.quantity + quantity, MAX_QUANTITY_PER_TITLE) } : line,
        );
      }
      return [...current, { book, quantity: Math.min(quantity, MAX_QUANTITY_PER_TITLE) }];
    });
  }

  function updateQuantity(bookId: string, quantity: number) {
    setLines((current) =>
      quantity <= 0
        ? current.filter((line) => line.book.id !== bookId)
        : current.map((line) => (line.book.id === bookId ? { ...line, quantity: Math.min(quantity, MAX_QUANTITY_PER_TITLE) } : line)),
    );
  }

  function removeItem(bookId: string) {
    setLines((current) => current.filter((line) => line.book.id !== bookId));
  }

  function clear() {
    setLines([]);
  }

  const { itemCount, subtotal } = useMemo(
    () =>
      lines.reduce(
        (totals, line) => ({
          itemCount: totals.itemCount + line.quantity,
          subtotal: totals.subtotal + line.book.price * line.quantity,
        }),
        { itemCount: 0, subtotal: 0 },
      ),
    [lines],
  );

  const value: CartContextValue = { lines, itemCount, subtotal, addItem, updateQuantity, removeItem, clear };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}
