import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { useFetch } from '../../hooks/useFetch';
import { api, ApiError } from '../../lib/api';
import { mapApiBook } from '../../lib/catalogue';
import { formatBookPrice } from '../../lib/format';
import { HERO_INK } from '../../lib/subjects';
import type { ApiBook, HeroColor } from '../../types/api';
import { BookCover } from '../../components/ui/BookCover';
import { Button } from '../../components/ui/Button';
import { LoadingBlock, ErrorBlock } from '../../components/ui/RequestState';
import styles from './AdminLayout.module.css';

interface AdminBook extends ApiBook {
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}

interface Slot {
  bookId: string;
  note: string;
  color: HeroColor | null;
}

const MAX_SLOTS = 5;
const COLORS: HeroColor[] = ['blue', 'pink', 'green', 'purple', 'orange'];

/** What the hero writes beside a book when staff leave the note empty. */
function autoNote(book: AdminBook) {
  return book.pages ? `${formatBookPrice(book.price)} · ${book.pages} pp` : formatBookPrice(book.price);
}

export default function AdminHero() {
  const { data: books, loading, error, reload } = useFetch(() => api.get<{ items: AdminBook[] }>('/admin/books').then((r) => r.items), []);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const published = books?.filter((book) => book.status === 'PUBLISHED') ?? [];

  // Start from what the site shows now.
  useEffect(() => {
    if (!books) return;
    setSlots(
      books
        .filter((book) => book.heroOrder != null)
        .sort((a, b) => a.heroOrder! - b.heroOrder!)
        .map((book) => ({ bookId: book.id, note: book.heroNote ?? '', color: book.heroColor })),
    );
  }, [books]);

  function update(index: number, patch: Partial<Slot>) {
    setSlots((current) => current.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
    setMessage(null);
  }

  function move(index: number, by: -1 | 1) {
    setSlots((current) => {
      const next = [...current];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return next;
    });
    setMessage(null);
  }

  function addSlot() {
    const unused = published.find((book) => !slots.some((slot) => slot.bookId === book.id));
    if (unused) setSlots((current) => [...current, { bookId: unused.id, note: '', color: null }]);
    setMessage(null);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      await api.put('/admin/books/hero', { slots: slots.map((slot) => ({ ...slot, note: slot.note.trim() || null })) });
      setMessage({ ok: true, text: 'Saved. The home page shows this now.' });
      reload();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof ApiError ? err.message : 'Could not save the hero.' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingBlock label="Loading books…" />;
  if (error || !books) return <ErrorBlock message={error ?? 'Could not load books.'} onRetry={reload} />;

  return (
    <div>
      <div className={styles.toolbar}>
        <h1 className={styles.pageTitle} style={{ marginBottom: 0 }}>
          Home hero
        </h1>
        <Button size="sm" variant="ghost" to="/">
          View home page
        </Button>
      </div>
      <p className={styles.heroIntro}>
        Pick up to {MAX_SLOTS} books for the top of the home page, in order. Each gets a handwritten note with an arrow, in
        the ink you choose. The NEW ED. sticker follows the book's New release tick. With no books picked, the home page
        shows new releases automatically.
      </p>

      <ol className={styles.heroSlots}>
        {slots.map((slot, index) => {
          const book = books.find((b) => b.id === slot.bookId);
          return (
            <li key={slot.bookId} className={`${styles.card} ${styles.heroSlot}`}>
              <span className={styles.heroPosition}>{index + 1}</span>
              <div className={styles.heroThumb}>{book && <BookCover book={mapApiBook(book)} size="small" />}</div>

              <div className={styles.heroFields}>
                <label>
                  <span>Book</span>
                  <select value={slot.bookId} onChange={(e) => update(index, { bookId: e.target.value })}>
                    {published
                      .filter((b) => b.id === slot.bookId || !slots.some((s) => s.bookId === b.id))
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.title}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  <span>Note beside it</span>
                  <input
                    value={slot.note}
                    maxLength={40}
                    placeholder={book ? autoNote(book) : ''}
                    onChange={(e) => update(index, { note: e.target.value })}
                  />
                </label>
                <fieldset className={styles.heroInks}>
                  <legend>Ink</legend>
                  {COLORS.map((color) => (
                    <label key={color} title={color}>
                      <input
                        type="radio"
                        name={`ink-${index}`}
                        checked={slot.color === color}
                        onChange={() => update(index, { color })}
                        aria-label={color}
                      />
                      <span style={{ background: HERO_INK[color] }} />
                    </label>
                  ))}
                  <label title="default">
                    <input type="radio" name={`ink-${index}`} checked={slot.color === null} onChange={() => update(index, { color: null })} />
                    <em>default</em>
                  </label>
                </fieldset>
                <p className={`${styles.heroPreview} hand`} style={{ color: slot.color ? HERO_INK[slot.color] : HERO_INK.blue }}>
                  {slot.note.trim() || (book ? autoNote(book) : '')}
                </p>
              </div>

              <div className={styles.heroActions}>
                <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up">
                  <ArrowUp size={16} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => move(index, 1)} disabled={index === slots.length - 1} aria-label="Move down">
                  <ArrowDown size={16} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => setSlots((current) => current.filter((_, i) => i !== index))} aria-label="Remove from hero">
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      <div className={styles.toolbar} style={{ marginTop: 'var(--space-4)' }}>
        <Button size="sm" variant="outline" type="button" onClick={addSlot} disabled={slots.length >= MAX_SLOTS || slots.length >= published.length}>
          <Plus size={16} aria-hidden="true" /> Add a book
        </Button>
        <Button size="md" variant="primary" type="button" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save hero'}
        </Button>
      </div>
      {message && (
        <p role="status" style={{ marginTop: 'var(--space-3)', color: message.ok ? 'var(--color-success)' : 'var(--color-error)' }}>
          {message.text}
        </p>
      )}
    </div>
  );
}
