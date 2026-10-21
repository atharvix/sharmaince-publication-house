import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchBooks, fetchCategories } from '../lib/catalogue';
import { useFetch } from '../hooks/useFetch';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import type { ApiFormat } from '../types/api';
import { PageHero } from '../components/ui/PageHero';
import { BookCard } from '../components/ui/BookCard';
import { Reveal } from '../components/ui/Reveal';
import { LoadingBlock, ErrorBlock } from '../components/ui/RequestState';
import styles from './Books.module.css';

type SortOrder = 'relevance' | 'price-asc' | 'price-desc' | 'title-asc';

const FORMATS: { value: ApiFormat; label: string }[] = [
  { value: 'PAPERBACK', label: 'Paperback' },
  { value: 'HARDBOUND', label: 'Hardbound' },
  { value: 'EBOOK', label: 'E-Book' },
];

export default function Books() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(searchParams.get('category'));
  const [format, setFormat] = useState<ApiFormat | null>(null);
  const [sort, setSort] = useState<SortOrder>('relevance');

  const debouncedQuery = useDebouncedValue(query, 300);
  const categoriesState = useFetch(() => fetchCategories(), []);
  const booksState = useFetch(
    () => fetchBooks({ q: debouncedQuery || undefined, category: category ?? undefined, format: format ?? undefined, sort, pageSize: 48 }),
    [debouncedQuery, category, format, sort],
  );

  function selectCategory(slug: string) {
    const next = category === slug ? null : slug;
    setCategory(next);
    if (searchParams.get('category')) {
      searchParams.delete('category');
      setSearchParams(searchParams, { replace: true });
    }
  }

  const activeCategoryName = categoriesState.data?.find((c) => c.slug === category)?.name;

  return (
    <>
      <PageHero
        title="Browse the Catalogue"
        subtitle="Search by title, author or ISBN, or filter by subject, format and availability."
        trail={[{ label: 'Books' }]}
      />

      <div className="container">
        <div className={styles.layout}>
          <aside className={styles.filters} aria-label="Filter books">
            <div className={styles.filterGroup}>
              <fieldset>
                <legend className={styles.filterLegend}>Subject</legend>
                {categoriesState.data?.map((c) => (
                  <label className={styles.checkRow} key={c.slug}>
                    <input type="checkbox" checked={category === c.slug} onChange={() => selectCategory(c.slug)} />
                    {c.name}
                  </label>
                ))}
              </fieldset>
            </div>

            <div className={styles.filterGroup}>
              <fieldset>
                <legend className={styles.filterLegend}>Format</legend>
                {FORMATS.map((f) => (
                  <label className={styles.checkRow} key={f.value}>
                    <input
                      type="checkbox"
                      checked={format === f.value}
                      onChange={() => setFormat((current) => (current === f.value ? null : f.value))}
                    />
                    {f.label}
                  </label>
                ))}
              </fieldset>
            </div>
          </aside>

          <div>
            <div className={styles.toolbar}>
              <div className={styles.searchBox}>
                <span className={styles.searchIcon} aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  type="search"
                  className={styles.searchInput}
                  placeholder="Search title, author or ISBN"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  aria-label="Search books"
                />
              </div>
              <select
                className={styles.sortSelect}
                value={sort}
                onChange={(event) => setSort(event.target.value as SortOrder)}
                aria-label="Sort books"
              >
                <option value="relevance">Sort: Relevance</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="title-asc">Title: A–Z</option>
              </select>
            </div>

            {category && activeCategoryName && (
              <div className={styles.activeFilters}>
                <span className={styles.filterChip}>
                  {activeCategoryName}
                  <button type="button" onClick={() => selectCategory(category)} aria-label={`Remove ${activeCategoryName} filter`}>
                    ×
                  </button>
                </span>
              </div>
            )}

            {booksState.loading && <LoadingBlock label="Searching the catalogue…" />}
            {booksState.error && <ErrorBlock message={booksState.error} onRetry={booksState.reload} />}

            {booksState.data && (
              <>
                <p className={styles.resultsCount} role="status">
                  {booksState.data.total} {booksState.data.total === 1 ? 'title' : 'titles'} found
                </p>

                {booksState.data.items.length > 0 ? (
                  <div className={styles.bookGrid}>
                    {booksState.data.items.map((book, index) => (
                      <Reveal key={book.slug} delay={Math.min(index * 50, 300)}>
                        <BookCard book={book} />
                      </Reveal>
                    ))}
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    <p className={styles.emptyIcon}>📖</p>
                    <p>No titles match your search. Try a different keyword or clear a filter.</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
