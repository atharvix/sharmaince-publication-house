import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { fetchBooks, fetchCategories } from '../lib/catalogue';
import { useFetch } from '../hooks/useFetch';
import { formatBookPrice } from '../lib/format';
import { subjectColor } from '../lib/subjects';
import type { Book } from '../types';
import { BookCard } from '../components/ui/BookCard';
import { BookCover } from '../components/ui/BookCover';
import { LoadingBlock, ErrorBlock } from '../components/ui/RequestState';
import styles from './Home.module.css';

const ROUTES = [
  { who: "I'm studying", where: 'Find my textbook', to: '/books' },
  { who: 'I teach', where: 'Get an inspection copy', to: '/contact?reason=inspection' },
  { who: 'I order for a college', where: 'Get a bulk quote', to: '/bulk-orders' },
];

function Go() {
  return (
    <span className={styles.go} aria-hidden="true">
      <ArrowRight size={20} strokeWidth={2.75} />
    </span>
  );
}

/** What gets written next to each cover in the pile: always real catalogue data. */
function annotation(book: Book, index: number) {
  if (index === 0 && book.pages) return `${formatBookPrice(book.price)} · ${book.pages} pp`;
  if (index === 2 && book.edition && book.pages) return `${book.edition.replace(/ Edition$/, ' ed.')}, ${book.pages} pages`;
  return formatBookPrice(book.price);
}

function Shelf({ title, highlight, books, total }: { title: string; highlight: string; books: Book[]; total?: number }) {
  return (
    <section className={`container ${styles.shelf}`}>
      <div className={styles.shelfHead}>
        <h2 className={styles.shelfTitle}>
          {title} <span className={styles.ink}>{highlight}</span>
        </h2>
        <Link to="/books" className={styles.more}>
          {total ? `All ${plural(total, 'title')}` : 'All titles'}
          <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" />
        </Link>
      </div>
      <div className={styles.books}>
        {books.map((book) => (
          <BookCard key={book.slug} book={book} />
        ))}
      </div>
    </section>
  );
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

export default function Home() {
  const booksState = useFetch(() => fetchBooks({ pageSize: 48, sort: 'relevance' }), []);
  const categoriesState = useFetch(() => fetchCategories(), []);

  const books = booksState.data?.items ?? [];
  const total = booksState.data?.total;
  const newEditions = books.filter((book) => book.newRelease);
  const featured = books.filter((book) => book.featured);
  // Staff pick the hero books in Admin → Books. Until they do, it leads with new
  // editions, then featured titles, then the rest.
  const picked = books.filter((book) => book.heroOrder != null).sort((a, b) => a.heroOrder! - b.heroOrder!);
  const pile = (picked.length > 0 ? picked : [...new Set([...newEditions, ...featured, ...books])]).slice(0, 5);
  const firstNew = pile.findIndex((b) => b.newRelease);
  const formats = [...new Set(books.map((book) => book.format.toLowerCase()))];
  // Subjects with no books yet would only lead to empty pages.
  const subjects = categoriesState.data?.filter((category) => (category.bookCount ?? 0) > 0) ?? [];
  // Featured titles that already appear on the new-editions shelf aren't repeated.
  const moreFeatured = featured.filter((book) => !book.newRelease);

  return (
    <>
      <section className={`container ${styles.spread}`}>
        <div className={styles.intro}>
          <h1 className={styles.title}>
            Publishing ideas. <em>Connecting readers.</em>
          </h1>
          {booksState.data && categoriesState.data && (
            <p className={styles.lede}>
              {plural(total ?? 0, 'title')} across {plural(subjects.length, 'subject')}
              {formats.length > 0 && <>, in {new Intl.ListFormat('en', { type: 'conjunction' }).format(formats)}</>}. Each book page shows its{' '}
              <span className="highlight">edition, pages and price</span> as soon as they're announced.
            </p>
          )}

          <nav className={styles.routes} aria-label="Where are you headed?">
            {ROUTES.map((route) => (
              <Link key={route.to} to={route.to} className={styles.route}>
                <span>
                  <small className="hand">{route.who}</small>
                  {route.where}
                </span>
                <Go />
              </Link>
            ))}
          </nav>
        </div>

        <div className={styles.pile} data-count={pile.length} aria-label="New and featured titles">
          {booksState.loading && <LoadingBlock label="Loading titles…" />}
          {pile.map((book, index) => (
            <Link key={book.slug} to={`/books/${book.slug}`} className={`${styles.cut} ${styles[`cut${index + 1}`]}`} aria-label={`${book.title}, ${formatBookPrice(book.price)}`}>
              <BookCover book={book} />
              <span className={`${styles.callout} ${styles[`callout${index + 1}`]} hand`} aria-hidden="true">
                {book.heroNote || annotation(book, index)}
              </span>
              {index === firstNew && (
                <span className={styles.burst} aria-hidden="true">
                  <span>
                    NEW
                    <br />
                    ED.
                  </span>
                </span>
              )}
            </Link>
          ))}
        </div>
      </section>

      <section className={`container ${styles.subjects}`}>
        <h2 className={styles.sticker}>Pick a subject</h2>
        {categoriesState.error && <ErrorBlock message={categoriesState.error} onRetry={categoriesState.reload} />}
        <ul className={styles.chips}>
          {subjects.map((category) => (
            <li key={category.slug}>
              <Link to={`/books?category=${encodeURIComponent(category.slug)}`} className={styles.chip}>
                <span className={styles.dot} style={{ background: subjectColor(category.slug) }} aria-hidden="true" />
                {category.name}
                <span className={`${styles.chipCount} hand`}>{category.bookCount ?? 0}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {booksState.error && (
        <div className="container">
          <ErrorBlock message={booksState.error} onRetry={booksState.reload} />
        </div>
      )}
      {newEditions.length > 0 && <Shelf title="Fresh off" highlight="the press" books={newEditions.slice(0, 4)} total={total} />}
      {moreFeatured.length > 0 && <Shelf title="Featured" highlight="titles" books={moreFeatured.slice(0, 8)} total={total} />}

      <section className={`container ${styles.proposalWrap}`}>
        <Link to="/authors#submit-manuscript" className={styles.proposal}>
          <span className={styles.proposalText}>
            <strong>Writing a textbook?</strong>
            <span>Send a proposal to our editorial team.</span>
          </span>
          <Go />
        </Link>
      </section>
    </>
  );
}
