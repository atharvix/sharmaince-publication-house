import { useState, type FormEvent } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { api, apiUpload, resolveAssetUrl, ApiError } from '../../lib/api';
import type { ApiBook, ApiCategory, ApiAuthorRef } from '../../types/api';
import { InputField, SelectField, TextareaField } from '../../components/ui/FormField';
import { Button } from '../../components/ui/Button';
import { ImageUpload } from '../../components/ui/ImageUpload';
import { BookCover } from '../../components/ui/BookCover';
import { LoadingBlock, ErrorBlock } from '../../components/ui/RequestState';
import styles from './AdminLayout.module.css';
import { formatRupees, humanizeEnum } from '../../lib/format';

interface AdminBook extends ApiBook {
  stockQuantity: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}

export default function AdminBooks() {
  const { data: books, loading, error, reload } = useFetch(() => api.get<{ items: AdminBook[] }>('/admin/books').then((r) => r.items), []);
  const { data: categories } = useFetch(() => api.get<{ items: ApiCategory[] }>('/admin/books/meta/categories').then((r) => r.items), []);
  const { data: authors } = useFetch(() => api.get<{ items: ApiAuthorRef[] }>('/admin/books/meta/authors').then((r) => r.items), []);

  const [editing, setEditing] = useState<AdminBook | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setEditing(null);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(book: AdminBook) {
    setEditing(book);
    setFormError(null);
    setShowForm(true);
  }

  async function handleCoverUpload(file: File) {
    if (!editing) return;
    const res = await apiUpload.post<{ book: AdminBook }>(`/admin/books/${editing.id}/cover`, 'cover', file);
    setEditing(res.book);
    reload();
  }

  async function handleCoverRemove() {
    if (!editing) return;
    const res = await api.delete<{ book: AdminBook }>(`/admin/books/${editing.id}/cover`);
    setEditing(res.book);
    reload();
  }

  async function handleArchive(id: string) {
    if (!window.confirm('Archive this book? It will be removed from the public catalogue.')) return;
    await api.delete(`/admin/books/${id}`);
    reload();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const authorIds = form.getAll('authorIds').map(String);
    const highlights = String(form.get('highlights') || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const payload = {
      slug: String(form.get('slug')),
      title: String(form.get('title')),
      subtitle: String(form.get('subtitle') || '') || undefined,
      categoryId: String(form.get('categoryId')),
      authorIds,
      price: Number(form.get('price')),
      edition: String(form.get('edition')),
      format: String(form.get('format')),
      isbn: String(form.get('isbn')),
      pages: Number(form.get('pages')),
      status: String(form.get('status')),
      availability: String(form.get('availability')),
      stockQuantity: Number(form.get('stockQuantity')),
      description: String(form.get('description')),
      highlights,
      coverPalette: String(form.get('coverPalette')),
      featured: form.get('featured') === 'on',
      newRelease: form.get('newRelease') === 'on',
    };

    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await api.patch(`/admin/books/${editing.id}`, payload);
      } else {
        await api.post('/admin/books', payload);
      }
      setShowForm(false);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save this book.');
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
          Books
        </h1>
        <Button size="sm" variant={showForm ? 'ghost' : 'primary'} type="button" onClick={() => (showForm ? setShowForm(false) : openCreate())}>
          {showForm ? 'Cancel' : 'Add book'}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className={styles.card}>
          <div className="form-grid form-grid--aside" style={{ gap: 'var(--space-5)', marginBottom: 'var(--space-4)' }}>
            {editing ? (
              <ImageUpload
                label="Cover image"
                value={resolveAssetUrl(editing.coverImageUrl)}
                onUpload={handleCoverUpload}
                onRemove={editing.coverImageUrl ? handleCoverRemove : undefined}
                hint="JPEG, PNG or WebP, up to 5MB. Falls back to the cover palette below when none is set."
              />
            ) : (
              <div>
                <p style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>Cover image</p>
                <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-ink-500)' }}>
                  Save this book first, then reopen it to upload a cover image.
                </p>
              </div>
            )}
            <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
              <InputField id="b-title" name="title" label="Title" required defaultValue={editing?.title} />
              <InputField id="b-slug" name="slug" label="Slug" required defaultValue={editing?.slug} hint="Used in the book's URL." />
            </div>
          </div>
          <InputField id="b-subtitle" name="subtitle" label="Subtitle" defaultValue={editing?.subtitle ?? ''} />
          <div className="form-grid form-grid--3" style={{ marginTop: 'var(--space-4)' }}>
            <SelectField id="b-category" name="categoryId" label="Category" required defaultValue={editing?.category.id ?? ''}>
              <option value="" disabled>
                Select
              </option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectField>
            <SelectField id="b-format" name="format" label="Format" required defaultValue={editing?.format ?? 'PAPERBACK'}>
              <option value="PAPERBACK">Paperback</option>
              <option value="HARDBOUND">Hardbound</option>
              <option value="EBOOK">E-Book</option>
            </SelectField>
            <SelectField id="b-cover" name="coverPalette" label="Cover palette" required defaultValue={editing?.coverPalette ?? 'pine'}>
              <option value="pine">Pine</option>
              <option value="amber">Amber</option>
              <option value="clay">Clay</option>
              <option value="slate">Slate</option>
            </SelectField>
          </div>

          <div style={{ marginTop: 'var(--space-4)' }}>
            <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, display: 'block', marginBottom: 'var(--space-2)' }}>Authors</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              {authors?.map((author) => (
                <label key={author.id} style={{ display: 'flex', gap: 'var(--space-2)', fontSize: 'var(--fs-sm)' }}>
                  <input
                    type="checkbox"
                    name="authorIds"
                    value={author.id}
                    defaultChecked={editing?.authors.some((a) => a.id === author.id)}
                  />
                  {author.name}
                </label>
              ))}
            </div>
          </div>

          <div className="form-grid form-grid--4" style={{ marginTop: 'var(--space-4)' }}>
            <InputField id="b-price" name="price" type="number" step="0.01" label="Price (₹)" required defaultValue={editing?.price} />
            <InputField id="b-edition" name="edition" label="Edition" required defaultValue={editing?.edition} />
            <InputField id="b-isbn" name="isbn" label="ISBN" required defaultValue={editing?.isbn} />
            <InputField id="b-pages" name="pages" type="number" label="Pages" required defaultValue={editing?.pages} />
          </div>

          <div className="form-grid form-grid--3" style={{ marginTop: 'var(--space-4)' }}>
            <SelectField id="b-status" name="status" label="Status" required defaultValue={editing?.status ?? 'DRAFT'}>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </SelectField>
            <SelectField id="b-availability" name="availability" label="Availability" required defaultValue={editing?.availability ?? 'IN_STOCK'}>
              <option value="IN_STOCK">In stock</option>
              <option value="PRE_ORDER">Pre-order</option>
              <option value="OUT_OF_STOCK">Out of stock</option>
            </SelectField>
            <InputField id="b-stock" name="stockQuantity" type="number" label="Stock quantity" required defaultValue={editing?.stockQuantity ?? 0} />
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-5)', marginTop: 'var(--space-4)' }}>
            <label style={{ display: 'flex', gap: 'var(--space-2)', fontSize: 'var(--fs-sm)' }}>
              <input type="checkbox" name="featured" defaultChecked={editing?.featured} /> Featured
            </label>
            <label style={{ display: 'flex', gap: 'var(--space-2)', fontSize: 'var(--fs-sm)' }}>
              <input type="checkbox" name="newRelease" defaultChecked={editing?.newRelease} /> New release
            </label>
          </div>

          <div style={{ marginTop: 'var(--space-4)' }}>
            <TextareaField id="b-description" name="description" label="Description" required defaultValue={editing?.description} />
          </div>
          <div style={{ marginTop: 'var(--space-4)' }}>
            <TextareaField
              id="b-highlights"
              name="highlights"
              label="Highlights"
              hint="One per line"
              defaultValue={editing?.highlights.join('\n')}
            />
          </div>

          {formError && <p style={{ color: 'var(--color-error)', fontSize: 'var(--fs-sm)', marginTop: 'var(--space-3)' }}>{formError}</p>}
          <div style={{ marginTop: 'var(--space-5)' }}>
            <Button type="submit" size="md" variant="primary" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Create book'}
            </Button>
          </div>
        </form>
      )}

      {books.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No books yet. Add your first title to get started.</p>
        </div>
      ) : (
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th></th>
              <th>Title</th>
              <th>Category</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {books.map((book) => (
              <tr key={book.id}>
                <td style={{ width: 48 }}>
                  <div style={{ width: 36, height: 48 }}>
                    <BookCover
                      size="small"
                      book={{
                        title: book.title,
                        author: book.authors.map((a) => a.name).join(' & '),
                        coverPalette: book.coverPalette,
                        coverImageUrl: book.coverImageUrl,
                        edition: book.edition,
                        format: book.format === 'PAPERBACK' ? 'Paperback' : book.format === 'HARDBOUND' ? 'Hardbound' : 'E-Book',
                      }}
                    />
                  </div>
                </td>
                <td>{book.title}</td>
                <td>{book.category.name}</td>
                <td>{formatRupees(book.price)}</td>
                <td>{book.stockQuantity}</td>
                <td>{humanizeEnum(book.status)}</td>
                <td style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <Button size="sm" variant="ghost" type="button" onClick={() => openEdit(book)}>
                    Edit
                  </Button>
                  {book.status !== 'ARCHIVED' && (
                    <Button size="sm" variant="ghost" type="button" onClick={() => handleArchive(book.id)}>
                      Archive
                    </Button>
                  )}
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
