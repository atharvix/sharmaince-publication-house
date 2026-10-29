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
import { ImageOff } from 'lucide-react';

interface AdminBook extends ApiBook {
  stockQuantity: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}

interface PrintedAuthor {
  name: string;
  credentials: string | null;
  bio: string | null;
  existingId: string | null;
}

/** What POST /admin/books/read-cover found on a cover photo. */
interface CoverRead {
  cover: string;
  readingEnabled: boolean;
  details: {
    title: string;
    subtitle: string | null;
    slug: string;
    isbn: string | null;
    edition: string | null;
    description: string;
    highlights: string[];
    categoryId: string | null;
    authors: PrintedAuthor[];
  } | null;
}

function dataUrlToFile(dataUrl: string, name: string) {
  const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (c) => c.charCodeAt(0));
  return new File([bytes], name, { type: 'image/jpeg' });
}

function slugify(text: string) {
  return text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 160);
}

export default function AdminBooks() {
  const { data: books, loading, error, reload } = useFetch(() => api.get<{ items: AdminBook[] }>('/admin/books').then((r) => r.items), []);
  const { data: categories } = useFetch(() => api.get<{ items: ApiCategory[] }>('/admin/books/meta/categories').then((r) => r.items), []);
  const { data: authors, reload: reloadAuthors } = useFetch(() => api.get<{ items: ApiAuthorRef[] }>('/admin/books/meta/authors').then((r) => r.items), []);

  const [editing, setEditing] = useState<AdminBook | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // A cover chosen while creating a book; it's uploaded right after the book is saved.
  const [pendingCover, setPendingCover] = useState<{ file: File; url: string } | null>(null);
  // Details read off that cover. The form is uncontrolled, so a new read re-keys it to apply them.
  const [draft, setDraft] = useState<CoverRead['details']>(null);
  const [draftKey, setDraftKey] = useState(0);
  const [coverNote, setCoverNote] = useState<string | null>(null);

  function clearPendingCover() {
    if (pendingCover?.url.startsWith('blob:')) URL.revokeObjectURL(pendingCover.url);
    setPendingCover(null);
  }

  function openCreate() {
    setEditing(null);
    clearPendingCover();
    setDraft(null);
    setCoverNote(null);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(book: AdminBook) {
    setEditing(book);
    setDraft(null);
    setCoverNote(null);
    setFormError(null);
    setShowForm(true);
  }

  async function handleCoverUpload(file: File) {
    if (!editing) {
      // The server crops and cleans the photo, and reads the details off it when it can.
      setCoverNote('Reading the cover…');
      const read = await apiUpload.post<CoverRead>('/admin/books/read-cover', 'cover', file).catch((err) => {
        setCoverNote(null);
        throw err;
      });
      clearPendingCover();
      setPendingCover({ file: dataUrlToFile(read.cover, 'cover.jpg'), url: read.cover });
      if (read.details) {
        setDraft(read.details);
        setDraftKey((key) => key + 1);
        setCoverNote('Filled in from the cover. Check it, then add the price, pages and stock.');
      } else {
        setCoverNote(read.readingEnabled ? "Couldn't read the details off this cover; please type them in." : null);
      }
      return;
    }
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
    const newAuthors = form.getAll('newAuthors').map((index) => draft!.authors[Number(index)]);
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
      featured: form.get('featured') === 'on',
      newRelease: form.get('newRelease') === 'on',
    };

    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await api.patch(`/admin/books/${editing.id}`, payload);
      } else {
        for (const author of newAuthors) {
          const res = await api.post<{ author: { id: string } }>('/admin/books/meta/authors', {
            slug: slugify(author.name.replace(/^(dr|prof|professor)\.?\s+/i, '')),
            name: author.name,
            credentials: author.credentials || 'Author',
            bio: author.bio || author.credentials || `Author of ${payload.title}.`,
          });
          payload.authorIds.push(res.author.id);
        }
        const created = await api.post<{ book: AdminBook }>('/admin/books', payload);
        if (pendingCover) {
          try {
            await apiUpload.post(`/admin/books/${created.book.id}/cover`, 'cover', pendingCover.file);
          } catch (err) {
            // The book exists now; reopen it so the cover can be retried without retyping everything.
            setEditing(created.book);
            setFormError(`Book saved, but the cover didn't upload: ${err instanceof ApiError ? err.message : 'please try again.'}`);
            clearPendingCover();
            reload();
            return;
          }
          clearPendingCover();
        }
      }
      setShowForm(false);
      setDraft(null);
      setCoverNote(null);
      reload();
      reloadAuthors();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save this book.');
    } finally {
      setSaving(false);
    }
  }

  const missingCovers = books?.filter((book) => !book.coverImageUrl).length ?? 0;

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
        <form key={draftKey} onSubmit={handleSubmit} className={styles.card}>
          <div className="form-grid form-grid--aside" style={{ gap: 'var(--space-5)', marginBottom: 'var(--space-4)' }}>
            <ImageUpload
              label="Cover photo"
              value={editing ? resolveAssetUrl(editing.coverImageUrl) : pendingCover?.url}
              onUpload={handleCoverUpload}
              onRemove={editing ? (editing.coverImageUrl ? handleCoverRemove : undefined) : pendingCover ? async () => clearPendingCover() : undefined}
              hint={
                editing
                  ? 'A photo or scan of the front cover. JPEG, PNG or WebP, up to 5MB. Shown on every page that lists this book.'
                  : 'Start here: a photo or scan of the cover, or the whole wraparound. It is cropped to the front cover and the details below are filled in for you.'
              }
            />
            <div style={{ display: 'grid', gap: 'var(--space-4)', alignContent: 'start' }}>
              {coverNote && (
                <p role="status" className={styles.coverNotice} style={{ margin: 0 }}>
                  {coverNote}
                </p>
              )}
              <InputField id="b-title" name="title" label="Title" required defaultValue={editing?.title ?? draft?.title} />
              <InputField id="b-slug" name="slug" label="Slug" required defaultValue={editing?.slug ?? draft?.slug} hint="Used in the book's URL." />
            </div>
          </div>
          <InputField id="b-subtitle" name="subtitle" label="Subtitle" defaultValue={editing?.subtitle ?? draft?.subtitle ?? ''} />
          <div className="form-grid form-grid--2" style={{ marginTop: 'var(--space-4)' }}>
            <SelectField id="b-category" name="categoryId" label="Category" required defaultValue={editing?.category.id ?? draft?.categoryId ?? ''}>
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
                    defaultChecked={editing ? editing.authors.some((a) => a.id === author.id) : draft?.authors.some((a) => a.existingId === author.id)}
                  />
                  {author.name}
                </label>
              ))}
              {draft?.authors.map((author, index) =>
                author.existingId ? null : (
                  <label key={author.name} style={{ display: 'flex', gap: 'var(--space-2)', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>
                    <input type="checkbox" name="newAuthors" value={index} defaultChecked />
                    {author.name} (new, added on save)
                  </label>
                ),
              )}
            </div>
          </div>

          <div className="form-grid form-grid--4" style={{ marginTop: 'var(--space-4)' }}>
            <InputField id="b-price" name="price" type="number" step="0.01" label="Price (₹)" required defaultValue={editing?.price} />
            <InputField id="b-edition" name="edition" label="Edition" required defaultValue={editing?.edition ?? draft?.edition ?? undefined} />
            <InputField id="b-isbn" name="isbn" label="ISBN" required defaultValue={editing?.isbn ?? draft?.isbn ?? undefined} />
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
            <TextareaField id="b-description" name="description" label="Description" required defaultValue={editing?.description ?? draft?.description} />
          </div>
          <div style={{ marginTop: 'var(--space-4)' }}>
            <TextareaField
              id="b-highlights"
              name="highlights"
              label="Highlights"
              hint="One per line"
              defaultValue={(editing?.highlights ?? draft?.highlights)?.join('\n')}
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

      {missingCovers > 0 && (
        <p className={styles.coverNotice}>
          <ImageOff size={18} strokeWidth={2} aria-hidden="true" />
          {missingCovers} of {books.length} books {missingCovers === 1 ? 'has' : 'have'} no cover photo yet. The site shows a plain stand-in for these until one is uploaded.
        </p>
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
                        coverImageUrl: book.coverImageUrl,
                        category: book.category,
                        edition: book.edition,
                        format: book.format === 'PAPERBACK' ? 'Paperback' : book.format === 'HARDBOUND' ? 'Hardbound' : 'E-Book',
                      }}
                    />
                  </div>
                </td>
                <td>
                  {book.title}
                  {!book.coverImageUrl && <span className={styles.noCover}>No photo</span>}
                </td>
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
