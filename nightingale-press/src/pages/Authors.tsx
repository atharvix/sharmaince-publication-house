import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { fetchAuthors } from '../lib/catalogue';
import { useFetch } from '../hooks/useFetch';
import { api, ApiError } from '../lib/api';
import { PageHero } from '../components/ui/PageHero';
import { SectionHeading } from '../components/ui/SectionHeading';
import { Button } from '../components/ui/Button';
import { Reveal } from '../components/ui/Reveal';
import { LoadingBlock, ErrorBlock } from '../components/ui/RequestState';
import { InputField, SelectField, TextareaField } from '../components/ui/FormField';
import { SuccessPanel } from '../components/ui/SuccessPanel';
import styles from './Authors.module.css';

const SUBJECT_AREAS = [
  'Nursing Foundations',
  'Community Health',
  'Medical-Surgical',
  'Pharmacology',
  'Anatomy & Physiology',
  'Paramedical Sciences',
  'Mental Health Nursing',
  'Other',
];

const GUIDELINES = [
  {
    title: 'Who we publish',
    body: 'Faculty, clinicians and researchers writing for nursing, medical and allied-health learners — from first-year foundational texts to advanced clinical references.',
  },
  {
    title: 'What to prepare',
    body: 'A proposal or sample chapter, a brief author CV, and an outline of the intended table of contents. Full manuscripts are welcome but not required at this stage.',
  },
  {
    title: 'What happens next',
    body: 'Submissions are acknowledged within a few days, and initial review typically takes 4–6 weeks. You will hear from our editorial team either way.',
  },
];

function initials(name: string) {
  return name
    .replace(/^(Dr\.|Prof\.)\s*/, '')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('');
}

export default function Authors() {
  const { data: authors, loading, error, reload } = useFetch(() => fetchAuthors(), []);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.post('/author-applications', {
        name: form.get('name'),
        email: form.get('email'),
        subjectArea: form.get('subjectArea'),
        workingTitle: form.get('workingTitle'),
        synopsis: form.get('synopsis'),
      });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHero
        title="Our Authors"
        subtitle="Nightingale titles are written by practising faculty and clinicians — people who teach the subject, and often still practise it."
        trail={[{ label: 'Authors' }]}
      />

      <section className={`container ${styles.section}`}>
        {loading && <LoadingBlock label="Loading authors…" />}
        {error && <ErrorBlock message={error} onRetry={reload} />}
        {authors && (
          <div className={styles.grid}>
            {authors.map((author, index) => (
              <Reveal key={author.slug} delay={index * 60} className={styles.card}>
                <div className={styles.avatar} aria-hidden="true">
                  {initials(author.name)}
                </div>
                <h2 className={styles.name}>{author.name}</h2>
                <p className={styles.credentials}>{author.credentials}</p>
                <p className={styles.bio}>{author.bio}</p>
                <div className={styles.bookLinks}>
                  {author.books.map((book) => (
                    <Link key={book.slug} to={`/books/${book.slug}`} className={styles.bookChip}>
                      {book.title}
                    </Link>
                  ))}
                </div>
              </Reveal>
            ))}
          </div>
        )}

        <Reveal className={styles.ctaBand}>
          <h2 className={styles.ctaTitle}>Have a manuscript in progress?</h2>
          <p className={styles.ctaBody}>
            We are actively reviewing proposals in nursing, paramedical sciences and allied-health
            subjects. Here is what we look for and how to submit.
          </p>
          <Button to="#submit-manuscript" variant="outline" size="md">
            Jump to Submission Form
          </Button>
        </Reveal>
      </section>

      <section className={`container ${styles.section}`}>
        <Reveal>
          <SectionHeading eyebrow="Submission Guidelines" title="What to know before you submit" />
        </Reveal>
        <div style={{ height: 'var(--space-7)' }} />
        <div className={styles.grid}>
          {GUIDELINES.map((item, index) => (
            <Reveal key={item.title} delay={index * 70} className={styles.card}>
              <h3 className={styles.name}>{item.title}</h3>
              <p className={styles.bio}>{item.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="submit-manuscript" className={`container ${styles.section}`} style={{ scrollMarginTop: 'calc(var(--header-height) + 16px)' }}>
        <Reveal>
          <SectionHeading
            eyebrow="Submit a Proposal"
            title="Tell us about your manuscript"
            subtitle="This starts a conversation with our editorial team — it does not commit you to anything."
          />
        </Reveal>
        <div style={{ height: 'var(--space-7)' }} />
        <Reveal className={styles.card} as="div">
          {submitted ? (
            <SuccessPanel
              title="Thank you — we've received your proposal"
              body="Our editorial team acknowledges every submission and typically completes an initial review within 4–6 weeks."
              resetLabel="Submit another proposal"
              onReset={() => setSubmitted(false)}
            />
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 'var(--space-5)', maxWidth: '640px' }}>
              <div style={{ display: 'grid', gap: 'var(--space-5)', gridTemplateColumns: '1fr 1fr' }}>
                <InputField id="author-name" name="name" label="Full name" required placeholder="Dr. Jane Doe" />
                <InputField id="author-email" name="email" type="email" label="Email address" required placeholder="you@institution.edu" />
              </div>
              <SelectField id="author-subject" name="subjectArea" label="Primary subject area" required defaultValue="">
                <option value="" disabled>
                  Select a subject
                </option>
                {SUBJECT_AREAS.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </SelectField>
              <InputField id="author-title" name="workingTitle" label="Working title" required placeholder="e.g. Essentials of Critical Care Nursing" />
              <TextareaField
                id="author-synopsis"
                name="synopsis"
                label="Brief synopsis"
                required
                placeholder="A short paragraph on scope, intended audience and what makes it distinct."
                hint="No confidential or unpublished clinical data, please — this is a first-contact summary only."
              />
              {submitError && <p style={{ color: 'var(--color-error)', fontSize: 'var(--fs-sm)' }}>{submitError}</p>}
              <Button type="submit" size="lg" variant="primary" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit Proposal'}
              </Button>
            </form>
          )}
        </Reveal>
      </section>
    </>
  );
}
