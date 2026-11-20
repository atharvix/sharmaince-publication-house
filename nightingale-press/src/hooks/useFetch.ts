import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../lib/api';

interface FetchState<T> {
  data: T | null;
  /** True only until the first result arrives, so pages can show a placeholder without unmounting on refetch. */
  loading: boolean;
  /** True while any request is in flight, including refetches after `reload()` or a deps change. */
  refreshing: boolean;
  error: string | null;
}

/** Runs an async loader on mount (and whenever `deps` change), tracking loading/error/data state. */
export function useFetch<T>(loader: () => Promise<T>, deps: unknown[]): FetchState<T> & { reload: () => void } {
  const [state, setState] = useState<FetchState<T>>({ data: null, loading: true, refreshing: true, error: null });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((prev) => ({ ...prev, refreshing: true, error: null }));

    loaderRef
      .current()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, refreshing: false, error: null });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
        // Keep whatever was already on screen; the error is shown alongside it.
        setState((prev) => ({ data: prev.data, loading: false, refreshing: false, error: message }));
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadKey]);

  return { ...state, reload: () => setReloadKey((k) => k + 1) };
}
