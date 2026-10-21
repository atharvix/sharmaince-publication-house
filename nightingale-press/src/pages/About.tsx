import { PageHero } from '../components/ui/PageHero';
import { SectionHeading } from '../components/ui/SectionHeading';
import { StatStrip } from '../components/ui/StatStrip';
import { Reveal } from '../components/ui/Reveal';
import { Button } from '../components/ui/Button';
import { LoadingBlock, ErrorBlock } from '../components/ui/RequestState';
import { useFetch } from '../hooks/useFetch';
import { fetchBooks, fetchCategories, fetchAuthors, fetchContentPage } from '../lib/catalogue';
import { cmsRichText } from '../lib/cms';
import styles from './About.module.css';

const PILLARS = [
  { icon: '🎓', title: 'Faculty-led development', body: 'Every title begins with educators who teach the subject, not just write about it.' },
  { icon: '🩺', title: 'Clinical review', body: 'Practising clinicians review content for accuracy against current practice standards.' },
  { icon: '📦', title: 'Dependable fulfilment', body: 'From a single copy to a full institutional order, we take delivery and support seriously.' },
];

export default function About() {
  const booksState = useFetch(() => fetchBooks({ pageSize: 1 }), []);
  const categoriesState = useFetch(() => fetchCategories(), []);
  const authorsState = useFetch(() => fetchAuthors(), []);
  const statsLoading = booksState.loading || categoriesState.loading || authorsState.loading;
  const statsError = booksState.error || categoriesState.error || authorsState.error;
  const statsReady = booksState.data && categoriesState.data && authorsState.data;

  // The About page's own layout (hero, pillars, CTA) is hand-built; CMS content only
  // overrides the intro paragraph and can append extra sections, so a draft CMS edit
  // never removes the built-in structure.
  const { data: cms } = useFetch(() => fetchContentPage('about'), []);

  return (
    <>
      <PageHero
        title={cms?.title ?? 'About Nightingale Academic Press'}
        subtitle="We publish nursing, medical and allied-health textbooks written with the people who teach them."
        trail={[{ label: 'About Us' }]}
      />

      <section className={`container ${styles.section}`}>
        <Reveal>
          {cms?.intro ? (
            <p className={styles.intro}>{cms.intro}</p>
          ) : (
            <p className={styles.intro}>
              Nightingale Academic Press exists for one reason: students preparing for clinical
              careers deserve textbooks that match how the subject is actually taught and practised.
              We work directly with faculty to plan, write and review every title, and with
              institutions to make sure the right books reach the right classrooms.
            </p>
          )}
        </Reveal>
      </section>

      <div className="container">
        <Reveal>
          {statsLoading && <LoadingBlock label="Loading catalogue statistics…" />}
          {statsError && <ErrorBlock message={statsError} />}
          {statsReady && (
            <StatStrip
              stats={[
                { value: String(booksState.data!.total), label: 'Titles in print' },
                { value: String(categoriesState.data!.length), label: 'Subject areas' },
                { value: String(authorsState.data!.length), label: 'Contributing authors' },
              ]}
            />
          )}
        </Reveal>
      </div>

      <section className={`container ${styles.section}`}>
        <Reveal>
          <SectionHeading center eyebrow="How we work" title="What every title has in common" />
        </Reveal>
        <div style={{ height: 'var(--space-7)' }} />
        <div className={styles.pillarGrid}>
          {PILLARS.map((pillar, index) => (
            <Reveal key={pillar.title} delay={index * 80} className={styles.pillarCard}>
              <div className={styles.pillarIcon} aria-hidden="true">
                {pillar.icon}
              </div>
              <h3>{pillar.title}</h3>
              <p style={{ marginTop: 'var(--space-2)', color: 'var(--color-ink-500)', fontSize: 'var(--fs-sm)' }}>
                {pillar.body}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      {cms && cms.sections.length > 0 && (
        <section className={`container ${styles.section}`}>
          {cms.sections.map((section, index) => (
            <Reveal key={section.heading} delay={index * 60}>
              <SectionHeading center title={section.heading} />
              <div style={{ maxWidth: '68ch', margin: '0 auto', color: 'var(--color-ink-700)' }}>
                {cmsRichText(section.body)}
              </div>
            </Reveal>
          ))}
        </section>
      )}

      <section className={`container ${styles.section}`} style={{ textAlign: 'center' }}>
        <Reveal>
          <SectionHeading center title="Want to work with us?" subtitle="Whether you're an author, an institution or a learner — we'd like to hear from you." />
          <div style={{ marginTop: 'var(--space-6)' }}>
            <Button to="/contact" size="lg" variant="primary">
              Get in Touch
            </Button>
          </div>
        </Reveal>
      </section>
    </>
  );
}
