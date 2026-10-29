/**
 * Every subject gets a band colour, used on stand-in covers and subject tabs. It's derived from the slug so subjects created in the admin get one automatically.
 */
const BAND_COUNT = 8;
// FNV-1a with a final mix. The seed was picked so the current seven subjects all get
// different colours; a future subject may share one.
const HASH_SEED = 20;

function hashSlug(slug: string) {
  let hash = 2166136261 ^ HASH_SEED;
  for (const char of slug) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x2c1b3c6d);
  hash ^= hash >>> 12;
  return hash >>> 0;
}

/** Stable band colour for a subject slug, as a CSS custom property reference. White text passes AA on it. */
export function subjectColor(slug: string): string {
  return `var(--sub-${(hashSlug(slug) % BAND_COUNT) + 1})`;
}

