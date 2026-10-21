import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { mkdir, unlink, writeFile } from 'node:fs/promises';

/**
 * Minimal file-storage abstraction. Only local disk is implemented today, but every
 * caller goes through this interface (not `fs` directly) so swapping in an S3/GCS
 * adapter later is a one-file change, not a rewrite of the upload routes.
 */
interface StorageAdapter {
  /** Persists a buffer and returns the public URL clients should use to fetch it. */
  save(buffer: Buffer, extension: string, subdir: string): Promise<string>;
  /** Removes a previously-saved file given the public URL `save` returned. */
  remove(publicUrl: string): Promise<void>;
}

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');
const PUBLIC_PREFIX = '/uploads';

const localDiskAdapter: StorageAdapter = {
  async save(buffer, extension, subdir) {
    const dir = path.join(UPLOAD_ROOT, subdir);
    await mkdir(dir, { recursive: true });
    const filename = `${randomUUID()}${extension}`;
    await writeFile(path.join(dir, filename), buffer);
    return `${PUBLIC_PREFIX}/${subdir}/${filename}`;
  },

  async remove(publicUrl) {
    if (!publicUrl.startsWith(PUBLIC_PREFIX)) return;
    const relative = publicUrl.slice(PUBLIC_PREFIX.length);
    const resolved = path.join(UPLOAD_ROOT, relative);
    // Guard against path traversal via a malformed stored URL.
    if (!resolved.startsWith(UPLOAD_ROOT)) return;
    await unlink(resolved).catch(() => undefined);
  },
};

/** Swap this for a cloud adapter by branching on an env var once one is configured. */
export const storage: StorageAdapter = localDiskAdapter;

export const UPLOADS_DIR = UPLOAD_ROOT;
