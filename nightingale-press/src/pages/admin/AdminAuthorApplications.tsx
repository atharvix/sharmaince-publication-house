import { useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { api, ApiError } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { ErrorBlock, LoadingBlock } from '../../components/ui/RequestState';
import styles from './AdminLayout.module.css';

type ApplicationStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'INFO_REQUESTED' | 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN' | 'CLOSED';

const STATUSES: ApplicationStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUESTED', 'ACCEPTED', 'DECLINED', 'WITHDRAWN', 'CLOSED'];

interface Note {
  id: string;
  note: string;
  createdAt: string;
  authorUser: { name: string };
}

interface Application {
  id: string;
  name: string;
  email: string;
  subjectArea: string;
  workingTitle: string;
  synopsis: string;
  status: ApplicationStatus;
  notes: Note[];
  createdAt: string;
}

export default function AdminAuthorApplications() {
  const { data, loading, error, reload } = useFetch(() => api.get<{ items: Application[] }>('/author-applications/admin').then((r) => r.items), []);
  const [actionError, setActionError] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  async function handleStatusChange(id: string, status: ApplicationStatus) {
    setActionError(null);
    try {
      await api.patch(`/author-applications/admin/${id}/status`, { status });
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not update this application.');
    }
  }

  async function handleAddNote(id: string) {
    const note = noteDraft[id]?.trim();
    if (!note) return;
    try {
      await api.post(`/author-applications/admin/${id}/notes`, { note });
      setNoteDraft((d) => ({ ...d, [id]: '' }));
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not save this note.');
    }
  }

  if (loading) return <LoadingBlock label="Loading applications…" />;
  if (error || !data) return <ErrorBlock message={error ?? 'Could not load applications.'} onRetry={reload} />;

  return (
    <div>
      <h1 className={styles.pageTitle}>Author Applications</h1>
      {actionError && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <ErrorBlock message={actionError} />
        </div>
      )}
      {data.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No author applications yet.</p>
        </div>
      ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {data.map((app) => (
          <div key={app.id} className={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
              <div>
                <strong>{app.workingTitle}</strong>
                <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-ink-500)' }}>
                  {app.name} · {app.email} · {app.subjectArea}
                </p>
              </div>
              <select className={styles.input} value={app.status} onChange={(e) => handleStatusChange(app.id, e.target.value as ApplicationStatus)}>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <p style={{ fontSize: 'var(--fs-sm)', marginTop: 'var(--space-3)' }}>{app.synopsis}</p>

            {app.notes.length > 0 && (
              <div style={{ marginTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-3)' }}>
                {app.notes.map((note) => (
                  <p key={note.id} style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-ink-500)', marginBottom: 'var(--space-2)' }}>
                    <strong>{note.authorUser.name}:</strong> {note.note}
                  </p>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
              <input
                className={styles.input}
                placeholder="Add an internal note…"
                value={noteDraft[app.id] ?? ''}
                onChange={(e) => setNoteDraft((d) => ({ ...d, [app.id]: e.target.value }))}
                style={{ flex: 1 }}
              />
              <Button size="sm" variant="ghost" type="button" onClick={() => handleAddNote(app.id)}>
                Add note
              </Button>
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
