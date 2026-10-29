import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchBooks, fetchCategories } from '../lib/catalogue';
import { useFetch } from '../hooks/useFetch';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { subjectColor } from '../lib/subjects';
import type { ApiFormat } from '../types/api';
import { PageHero } from '../components/ui/PageHero';
import { BookCard } from '../components/ui/BookCard';
import { LoadingBlock, ErrorBlock } from '../components/ui/RequestState';
import styles from './Books.module.css';

type SortOrder = 'relevance' | 'price-asc' | 'price-desc' | 'title-asc';

const FORMATS: { value: ApiFormat; label: string }[] = [
  { value: 'PAPERBACK', label: 'Paperback' },
  { value: 'HARDBOUND', label: 'Hardbound' },
  { value: 'EBOOK', label: 'E-book' },
];
const SORTS: SortOrder[] = ['relevance', 'price-asc', 'price-desc', 'title-asc'];

export default function Books() {
  // The URL is the source of truth, so header searches, subject links and shared links all land intact.
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') ?? '';
  const category = searchParams.get('category');
  const format = FORMATS.some((f) => f.value === searchParams.get('format')) ? (searchParams.get('format') as ApiFormat) : null;
  const sort = SORTS.includes(searchParams.get('sort') as SortOrder) ? (searchParams.get('sort') as SortOrder) : 'relevance';

  const [query, setQuery] = useState(urlQuery);
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  // Adopt a new search from the URL (e.g. the header search) without an effect.
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    setQuery(urlQuery);
  }
  const debouncedQuery = useDebouncedValue(query.trim(), 300);

  function update(key: string, value: string | null) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  }

  useEffect(() => {
    if (debouncedQuery !== urlQuery) {
      setSyncedQuery(debouncedQuery);
      update('q', debouncedQuery || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  const categoriesState = useFetch(() => fetchCategories(), []);
  const booksState = useFetch(
    () => fetchBooks({ q: urlQuery || undefined, category: category ?? undefined, format: format ?? undefined, sort, pageSize: 48 }),
    [urlQuery, category, format, sort],
  );

  const activeCategory = categoriesState.data?.find((c) => c.slug === category);
  const filtered = Boolean(urlQuery || category || format);

  return (
    <>
      <PageHero title="Catalogue" subtitle="Search by title, author or ISBN, or jump straight to a subject." trail={[{ label: 'Books' }]} />

      <div className={`container ${styles.page}`}>
        <div className={styles.controls}>
          <label className={styles.search}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2.6" />
              <path d="m20 20-3.6-3.6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
            </svg>
            <span className="visually-hidden">Search books</span>
            <input type="search" placeholder="Title, author or ISBN" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <div className={styles.segmented} role="group" aria-label="Format">
            <button type="button" aria-pressed={!format} onClick={() => update('format', null)}>
              All
            </button>
            {FORMATS.map((f) => (
              <button type="button" key={f.value} aria-pressed={format === f.value} onClick={() => update('format', format === f.value ? null : f.value)}>
                {f.label}
              </button>
            ))}
          </div>
          <label className={styles.sort}>
            <span>Sort</span>
            <select value={sort} onChange={(event) => update('sort', event.target.value === 'relevance' ? null : event.target.value)}>
              <option value="relevance">Featured first</option>
              <option value="title-asc">Title A–Z</option>
              <option value="price-asc">Price, low to high</option>
              <option value="price-desc">Price, high to low</option>
            </select>
          </label>
        </div>

        <div className={styles.tabs} role="tablist" aria-label="Subject">
          <button type="button" role="tab" aria-selected={!category} className={styles.tab} onClick={() => update('category', null)}>
            All subjects
            <span className={`${styles.tabCount} tabular`}>{categoriesState.data?.reduce((sum, c) => sum + (c.bookCount ?? 0), 0) ?? ''}</span>
          </button>
          {categoriesState.data?.map((c) => (
            <button type="button" role="tab" key={c.slug} aria-selected={category === c.slug} className={styles.tab} onClick={() => update('category', category === c.slug ? null : c.slug)}>
              <span className={styles.dot} style={{ background: subjectColor(c.slug) }} aria-hidden="true" />
              {c.name}
              <span className={`${styles.tabCount} tabular`}>{c.bookCount ?? 0}</span>
            </button>
          ))}
        </div>

        <div className={styles.status} role="status">
          {booksState.data && (
            <p>
              <strong className="tabular">{booksState.data.total}</strong> {booksState.data.total === 1 ? 'title' : 'titles'}
              {activeCategory && <> in {activeCategory.name}</>}
              {urlQuery && <> matching “{urlQuery}”</>}
            </p>
          )}
          {filtered && (
            <button type="button" className={styles.clear} onClick={() => setSearchParams({}, { replace: true })}>
              Clear filters
            </button>
          )}
        </div>

        {booksState.loading && <LoadingBlock label="Searching the catalogue…" />}
        {booksState.error && <ErrorBlock message={booksState.error} onRetry={booksState.reload} />}

        {booksState.data &&
          (booksState.data.items.length > 0 ? (
            <div className={styles.grid} aria-busy={booksState.refreshing}>
              {booksState.data.items.map((book) => (
                <BookCard key={book.slug} book={book} />
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <h2>No titles match</h2>
              <p>Check the spelling, try the author's surname or an ISBN, or clear the filters.</p>
            </div>
          ))}
      </div>
    </>
  );
}
