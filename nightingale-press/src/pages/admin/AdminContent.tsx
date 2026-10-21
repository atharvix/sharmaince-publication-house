import { useState, type FormEvent } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { api, ApiError } from '../../lib/api';
import { InputField, SelectField, TextareaField } from '../../components/ui/FormField';
import { Button } from '../../components/ui/Button';
import { LoadingBlock, ErrorBlock } from '../../components/ui/RequestState';
import styles from './AdminLayout.module.css';

const PAGE_SLUGS = ['about', 'shipping', 'returns', 'privacy', 'terms', 'cookies'];
const PAGE_LABELS: Record<string, string> = {
  about: 'About',
  shipping: 'Shipping',
  returns: 'Returns & Refunds',
  privacy: 'Privacy Policy',
  terms: 'Terms of Service',
  cookies: 'Cookie Policy',
};
const TOPICS = ['ORDERS', 'DELIVERY', 'RETURNS', 'SUBMISSIONS', 'ACCOUNTS'];

interface Faq {
  id: string;
  topic: string;
  question: string;
  answer: string;
  sortOrder: number;
  isPublished: boolean;
}

interface ContentPage {
  slug: string;
  title: string;
  intro: string | null;
  sections: { heading: string; body: string }[];
  isPublished: boolean;
}

export default function AdminContent() {
  const { data: faqs, loading: loadingFaqs, error: faqsError, reload: reloadFaqs } = useFetch(
    () => api.get<{ items: Faq[] }>('/admin/content/faqs').then((r) => r.items),
    [],
  );
  const { data: pages, reload: reloadPages } = useFetch(() => api.get<{ items: ContentPage[] }>('/admin/content/pages').then((r) => r.items), []);

  const [faqError, setFaqError] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState(PAGE_SLUGS[0]);
  const [pageError, setPageError] = useState<string | null>(null);
  const [savingPage, setSavingPage] = useState(false);

  const currentPage = pages?.find((p) => p.slug === selectedSlug);

  async function handleAddFaq(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setFaqError(null);
    try {
      await api.post('/admin/content/faqs', {
        topic: String(form.get('topic')),
        question: String(form.get('question')),
        answer: String(form.get('answer')),
        sortOrder: 0,
        isPublished: true,
      });
      event.currentTarget.reset();
      reloadFaqs();
    } catch (err) {
      setFaqError(err instanceof ApiError ? err.message : 'Could not save this FAQ.');
    }
  }

  async function handleDeleteFaq(id: string) {
    await api.delete(`/admin/content/faqs/${id}`);
    reloadFaqs();
  }

  async function handleSavePage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const sectionsRaw = String(form.get('sections') || '');
    const sections = sectionsRaw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [heading, ...bodyParts] = line.split('|');
        return { heading: heading.trim(), body: bodyParts.join('|').trim() };
      });

    setSavingPage(true);
    setPageError(null);
    try {
      await api.put(`/admin/content/pages/${selectedSlug}`, {
        title: String(form.get('title')),
        intro: String(form.get('intro') || '') || undefined,
        sections,
        isPublished: form.get('isPublished') === 'on',
      });
      reloadPages();
    } catch (err) {
      setPageError(err instanceof ApiError ? err.message : 'Could not save this page.');
    } finally {
      setSavingPage(false);
    }
  }

  return (
    <div>
      <h1 className={styles.pageTitle}>Content</h1>

      <div className={styles.card}>
        <h2 style={{ marginBottom: 'var(--space-4)' }}>Static page content</h2>
        <p style={{ marginTop: `calc(var(--space-2) * -1)`, marginBottom: 'var(--space-4)', color: 'var(--color-ink-500)', fontSize: 'var(--fs-sm)' }}>
          Published pages replace the default copy on the live site immediately. Unpublished pages keep showing the
          site's built-in default content, so you can draft changes here without affecting visitors.
        </p>
        <SelectField
          id="content-page-slug"
          label="Page"
          value={selectedSlug}
          onChange={(e) => setSelectedSlug(e.target.value)}
        >
          {PAGE_SLUGS.map((slug) => (
            <option key={slug} value={slug}>
              {PAGE_LABELS[slug]}
            </option>
          ))}
        </SelectField>

        <form onSubmit={handleSavePage} style={{ display: 'grid', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
          <InputField id="page-title" name="title" label="Title" required defaultValue={currentPage?.title ?? ''} key={`${selectedSlug}-title`} />
          <TextareaField id="page-intro" name="intro" label="Intro" defaultValue={currentPage?.intro ?? ''} key={`${selectedSlug}-intro`} />
          <TextareaField
            id="page-sections"
            name="sections"
            label="Sections"
            hint="One per line, as: Heading | Body text"
            defaultValue={currentPage?.sections.map((s) => `${s.heading} | ${s.body}`).join('\n') ?? ''}
            key={`${selectedSlug}-sections`}
            style={{ minHeight: 160 }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--fs-sm)', fontWeight: 600 }} key={`${selectedSlug}-published`}>
            <input type="checkbox" name="isPublished" defaultChecked={currentPage?.isPublished ?? true} />
            Published — visible on the live site
          </label>
          {pageError && <p style={{ color: 'var(--color-error)', fontSize: 'var(--fs-sm)' }}>{pageError}</p>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <Button type="submit" size="md" variant="primary" disabled={savingPage}>
              {savingPage ? 'Saving…' : 'Save page'}
            </Button>
            {currentPage && (
              <span className={styles.badge} style={{ background: currentPage.isPublished ? 'var(--color-success-bg)' : 'var(--color-paper-200)', color: currentPage.isPublished ? 'var(--color-success)' : 'var(--color-ink-500)' }}>
                {currentPage.isPublished ? 'Published' : 'Draft'}
              </span>
            )}
          </div>
        </form>
      </div>

      <div className={styles.card}>
        <h2 style={{ marginBottom: 'var(--space-4)' }}>FAQs</h2>
        <form onSubmit={handleAddFaq} style={{ display: 'grid', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
          <div style={{ display: 'grid', gap: 'var(--space-4)', gridTemplateColumns: '160px 1fr' }}>
            <SelectField id="faq-topic" name="topic" label="Topic" required defaultValue="ORDERS">
              {TOPICS.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </SelectField>
            <InputField id="faq-question" name="question" label="Question" required />
          </div>
          <TextareaField id="faq-answer" name="answer" label="Answer" required />
          {faqError && <p style={{ color: 'var(--color-error)', fontSize: 'var(--fs-sm)' }}>{faqError}</p>}
          <div>
            <Button type="submit" size="sm" variant="primary">
              Add FAQ
            </Button>
          </div>
        </form>

        {loadingFaqs && <LoadingBlock label="Loading FAQs…" />}
        {faqsError && <ErrorBlock message={faqsError} onRetry={reloadFaqs} />}
        {faqs && faqs.length === 0 && (
          <div className={styles.emptyState}>
            <p>No FAQs yet. Add one above.</p>
          </div>
        )}
        {faqs && faqs.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Topic</th>
                  <th>Question</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {faqs.map((faq) => (
                  <tr key={faq.id}>
                    <td>{faq.topic}</td>
                    <td>{faq.question}</td>
                    <td>
                      <Button size="sm" variant="ghost" type="button" onClick={() => handleDeleteFaq(faq.id)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
