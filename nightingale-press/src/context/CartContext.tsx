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
      return raw ? (JSON.parse(raw) as CartLine[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines]);

  function addItem(book: CartBookSnapshot, quantity = 1) {
    setLines((current) => {
      const existing = current.find((line) => line.book.id === book.id);
      if (existing) {
        return current.map((line) => (line.book.id === book.id ? { ...line, quantity: line.quantity + quantity } : line));
      }
      return [...current, { book, quantity }];
    });
  }

  function updateQuantity(bookId: string, quantity: number) {
    setLines((current) =>
      quantity <= 0
        ? current.filter((line) => line.book.id !== bookId)
        : current.map((line) => (line.book.id === bookId ? { ...line, quantity } : line)),
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
