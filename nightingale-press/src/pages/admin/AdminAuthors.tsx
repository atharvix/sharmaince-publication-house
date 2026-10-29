import { useState, type FormEvent } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { api, ApiError } from '../../lib/api';
import type { ApiAuthor } from '../../types/api';
import { InputField, TextareaField } from '../../components/ui/FormField';
import { Button } from '../../components/ui/Button';
import { LoadingBlock, ErrorBlock } from '../../components/ui/RequestState';
import styles from './AdminLayout.module.css';

export default function AdminAuthors() {
  const { data: authors, loading, error, reload } = useFetch(() => api.get<{ items: ApiAuthor[] }>('/admin/books/meta/authors').then((r) => r.items), []);
  const [editing, setEditing] = useState<ApiAuthor | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      slug: String(form.get('slug')),
      name: String(form.get('name')),
      credentials: String(form.get('credentials')),
      bio: String(form.get('bio')),
    };
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await api.patch(`/admin/books/meta/authors/${editing.id}`, payload);
      } else {
        await api.post('/admin/books/meta/authors', payload);
      }
      setShowForm(false);
      setEditing(null);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save this author.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingBlock label="Loading authors…" />;
  if (error || !authors) return <ErrorBlock message={error ?? 'Could not load authors.'} onRetry={reload} />;

  return (
    <div>
      <div className={styles.toolbar}>
        <h1 className={styles.pageTitle} style={{ marginBottom: 0 }}>
          Authors
        </h1>
        <Button
          size="sm"
          variant={showForm ? 'ghost' : 'primary'}
          type="button"
          onClick={() => {
            setEditing(null);
            setShowForm((v) => !v);
          }}
        >
          {showForm ? 'Cancel' : 'Add author'}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className={styles.card}>
          <div className="form-grid form-grid--2">
            <InputField id="a-name" name="name" label="Name" required defaultValue={editing?.name} />
            <InputField id="a-slug" name="slug" label="Slug" required defaultValue={editing?.slug} />
          </div>
          <div style={{ marginTop: 'var(--space-4)' }}>
            <InputField id="a-credentials" name="credentials" label="Credentials" required defaultValue={editing?.credentials} />
          </div>
          <div style={{ marginTop: 'var(--space-4)' }}>
            <TextareaField id="a-bio" name="bio" label="Bio" required defaultValue={editing?.bio} />
          </div>
          {formError && <p style={{ color: 'var(--color-error)', fontSize: 'var(--fs-sm)', marginTop: 'var(--space-3)' }}>{formError}</p>}
          <div style={{ marginTop: 'var(--space-5)' }}>
            <Button type="submit" size="md" variant="primary" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create author'}
            </Button>
          </div>
        </form>
      )}

      {authors.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No authors yet. Add your first author to get started.</p>
        </div>
      ) : (
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Credentials</th>
              <th>Books</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {authors.map((author) => (
              <tr key={author.slug}>
                <td>{author.name}</td>
                <td>{author.credentials}</td>
                <td>{author.books.length}</td>
                <td>
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={() => {
                      setEditing(author);
                      setShowForm(true);
                    }}
                  >
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
