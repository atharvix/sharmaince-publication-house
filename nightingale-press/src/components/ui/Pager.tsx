import { Button } from './Button';
import styles from './Pager.module.css';

export interface PageMeta {
  page: number;
  totalPages: number;
  total: number;
}

/** Previous/next controls for the API's `{ page, totalPages, total }` list responses. Renders nothing for a single page. */
export function Pager({ meta, onPage, disabled }: { meta: PageMeta; onPage: (page: number) => void; disabled?: boolean }) {
  if (meta.totalPages <= 1) return null;
  return (
    <nav className={styles.pager} aria-label="Pagination">
      <Button size="sm" variant="outline" type="button" disabled={disabled || meta.page <= 1} onClick={() => onPage(meta.page - 1)}>
        Previous
      </Button>
      <span className={styles.status}>
        Page {meta.page} of {meta.totalPages} · {meta.total} total
      </span>
      <Button size="sm" variant="outline" type="button" disabled={disabled || meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>
        Next
      </Button>
    </nav>
  );
}
