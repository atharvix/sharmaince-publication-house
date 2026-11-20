/**
 * Returns `target` only if it is a path on this site. `?redirect=` comes from the URL, so
 * anything else (`https://…`, `//evil.example`, `javascript:`) falls back to `fallback`.
 */
export function safeRedirect(target: string | null, fallback: string) {
  if (!target || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) return fallback;
  return target;
}
