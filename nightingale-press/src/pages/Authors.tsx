import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { fetchAuthors } from '../lib/catalogue';
import { useFetch } from '../hooks/useFetch';
import { api, ApiError } from '../lib/api';
import { PageHero } from '../components/ui/PageHero';
import { SectionHeading } from '../components/ui/SectionHeading';
import { Button } from '../components/ui/Button';
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
  'Psychology & Sociology',
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
    body: 'Our editorial team replies to every proposal by email, whether or not it is a fit.',
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
        title="Authors"
        subtitle="The faculty and clinicians who write Sharmiance titles, and how to send us a proposal of your own."
        trail={[{ label: 'Authors' }]}
      />

      <section className={`container ${styles.section}`}>
        {loading && <LoadingBlock label="Loading authors…" />}
        {error && <ErrorBlock message={error} onRetry={reload} />}
        {authors && (
          <ul className={styles.directory}>
            {authors.map((author) => (
              <li key={author.slug} className={styles.entry}>
                <span className={styles.monogram} aria-hidden="true">
                  {initials(author.name)}
                </span>
                <div className={styles.who}>
                  <h2 className={styles.name}>{author.name}</h2>
                  <p className={styles.credentials}>{author.credentials}</p>
                </div>
                <p className={styles.bio}>{author.bio}</p>
                {author.books.length > 0 && (
                  <ul className={styles.books} aria-label={`Books by ${author.name}`}>
                    {author.books.map((book) => (
                      <li key={book.slug}>
                        <Link to={`/books/${book.slug}`} className={styles.bookLink}>
                          <BookOpen size={16} strokeWidth={1.9} aria-hidden="true" />
                          {book.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="submit-manuscript" className={`container ${styles.submit}`} style={{ scrollMarginTop: 'calc(var(--header-height) + 16px)' }}>
        <div className={styles.guide}>
          <SectionHeading title="Send us a proposal" subtitle="This starts a conversation with our editorial team. It doesn't commit you to anything." />
          <ol className={styles.steps}>
            {GUIDELINES.map((item, index) => (
              <li key={item.title} className={styles.step}>
                <span className={styles.stepNumber} aria-hidden="true">
                  {index + 1}
                </span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className={styles.formCard}>
          {submitted ? (
            <SuccessPanel
              title="Thank you, we've received your proposal"
              body="Our editorial team will reply to the email address you gave."
              resetLabel="Submit another proposal"
              onReset={() => setSubmitted(false)}
            />
          ) : (
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className="form-grid form-grid--2">
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
                hint="Please don't include confidential or unpublished clinical data. This is a first-contact summary only."
              />
              {submitError && (
                <p className={styles.error} role="alert">
                  {submitError}
                </p>
              )}
              <Button type="submit" size="lg" variant="primary" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send proposal'}
              </Button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
