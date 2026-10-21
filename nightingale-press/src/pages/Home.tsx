import { Link } from 'react-router-dom';
import { fetchBooks, fetchCategories, fetchAuthors } from '../lib/catalogue';
import { useFetch } from '../hooks/useFetch';
import { Button } from '../components/ui/Button';
import { BookCard } from '../components/ui/BookCard';
import { BookCover } from '../components/ui/BookCover';
import { SectionHeading } from '../components/ui/SectionHeading';
import { StatStrip } from '../components/ui/StatStrip';
import { Reveal } from '../components/ui/Reveal';
import { LoadingBlock, ErrorBlock } from '../components/ui/RequestState';
import styles from './Home.module.css';

const VALUE_PROPS = [
  {
    icon: '◎',
    title: 'Curriculum-aligned content',
    body: 'Every title is developed alongside practising faculty and mapped to current nursing and allied-health syllabi.',
  },
  {
    icon: '✓',
    title: 'Rigorously reviewed',
    body: 'Manuscripts pass through subject-matter and clinical review before a single page goes to print.',
  },
  {
    icon: '→',
    title: 'Reliable nationwide delivery',
    body: 'From single copies to full-batch institutional orders, dispatch and tracking are built into every order.',
  },
];

export default function Home() {
  const booksState = useFetch(() => fetchBooks({ pageSize: 48, sort: 'relevance' }), []);
  const categoriesState = useFetch(() => fetchCategories(), []);
  const authorsState = useFetch(() => fetchAuthors(), []);

  const allBooks = booksState.data?.items ?? [];
  const statsReady = booksState.data && categoriesState.data && authorsState.data;
  const featuredBooks = allBooks.filter((book) => book.featured);
  const stackBooks = featuredBooks.slice(0, 3);

  return (
    <>
      <section className={styles.hero}>
        <div className={`container ${styles.heroGrid}`}>
          <Reveal>
            <span className={styles.eyebrow}>Nursing &amp; Allied-Health Publishing</span>
            <h1 className={styles.heroTitle}>Textbooks built for the realities of clinical practice.</h1>
            <p className={styles.heroSubtitle}>
              Nightingale Academic Press publishes curriculum-aligned nursing, medical and
              allied-health titles — written with faculty, reviewed by clinicians, and trusted in
              classrooms and wards across the country.
            </p>
            <div className={styles.heroActions}>
              <Button to="/books" size="lg" variant="primary">
                Explore Books
              </Button>
              <Button to="/authors" size="lg" variant="outline">
                Submit a Manuscript
              </Button>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className={styles.heroVisual} aria-hidden="true">
              {stackBooks.map((book) => (
                <div className={styles.stackItem} key={book.slug}>
                  <BookCover book={book} />
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {statsReady && (
        <div className="container">
          <Reveal>
            <StatStrip
              stats={[
                { value: String(booksState.data!.total), label: 'Published titles' },
                { value: String(categoriesState.data!.length), label: 'Subject areas' },
                { value: String(authorsState.data!.length), label: 'Contributing authors' },
              ]}
            />
          </Reveal>
        </div>
      )}

      <section className={`container ${styles.section}`}>
        <Reveal>
          <SectionHeading eyebrow="Browse by subject" title="Find the right title for every stage of training" />
        </Reveal>
        <div style={{ height: 'var(--space-7)' }} />
        {categoriesState.loading && <LoadingBlock label="Loading subjects…" />}
        {categoriesState.error && <ErrorBlock message={categoriesState.error} onRetry={categoriesState.reload} />}
        {categoriesState.data && (
          <div className={styles.categoryGrid}>
            {categoriesState.data.map((category, index) => (
              <Reveal key={category.slug} delay={index * 60}>
                <Link to={`/books?category=${encodeURIComponent(category.slug)}`} className={styles.categoryCard}>
                  <span className={styles.categoryDot} aria-hidden="true" />
                  <span className={styles.categoryName}>{category.name}</span>
                  <span className={styles.categoryCount}>{category.bookCount ?? 0} titles</span>
                </Link>
              </Reveal>
            ))}
          </div>
        )}
      </section>

      <section className={`container ${styles.section}`}>
        <div className={styles.sectionHeadRow}>
          <Reveal>
            <SectionHeading eyebrow="Featured" title="Widely adopted this semester" />
          </Reveal>
          <Reveal delay={80}>
            <Button to="/books" variant="ghost">
              View full catalogue →
            </Button>
          </Reveal>
        </div>
        {booksState.loading && <LoadingBlock label="Loading featured titles…" />}
        {booksState.error && <ErrorBlock message={booksState.error} onRetry={booksState.reload} />}
        {booksState.data && (
          <div className={styles.bookGrid}>
            {featuredBooks.map((book, index) => (
              <Reveal key={book.slug} delay={index * 70}>
                <BookCard book={book} />
              </Reveal>
            ))}
          </div>
        )}
      </section>

      <section className={`container ${styles.sectionTight}`}>
        <Reveal>
          <SectionHeading
            center
            eyebrow="Why Nightingale"
            title="Built with educators, not just for them"
            subtitle="We work closely with teaching faculty at every stage — from planning a table of contents to classroom feedback after adoption."
          />
        </Reveal>
        <div style={{ height: 'var(--space-7)' }} />
        <div className={styles.valueGrid}>
          {VALUE_PROPS.map((item, index) => (
            <Reveal key={item.title} delay={index * 80} className={styles.valueCard}>
              <div className={styles.valueIcon} aria-hidden="true">
                {item.icon}
              </div>
              <h3 className={styles.valueTitle}>{item.title}</h3>
              <p className={styles.valueBody}>{item.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className={`container ${styles.section}`}>
        <Reveal>
          <div className={styles.ctaBand}>
            <div>
              <h2 className={styles.ctaBandTitle}>Ordering for a college, library or bookstore?</h2>
              <p className={styles.ctaBandBody}>
                Request institutional pricing, consolidated invoicing and coordinated delivery for
                bulk orders of any size.
              </p>
            </div>
            <div className={styles.ctaBandActions}>
              <Button to="/bulk-orders" size="lg" variant="accent">
                Start a Bulk Order
              </Button>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
