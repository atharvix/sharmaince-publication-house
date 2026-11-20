import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { env } from '../env.js';

/**
 * File storage. Only local disk is implemented, which ties uploads to one host (or a
 * shared volume): run a single API instance, or add an object-storage adapter here
 * before scaling out. Callers only use this interface, never `fs` directly.
 */
interface StorageAdapter {
  /** Persists a buffer and returns the public URL clients should use to fetch it. */
  save(buffer: Buffer, extension: string, subdir: string): Promise<string>;
  /** Removes a previously-saved file given the public URL `save` returned. */
  remove(publicUrl: string): Promise<void>;
}

const UPLOAD_ROOT = path.resolve(env.UPLOADS_DIR);
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
    const resolved = path.resolve(UPLOAD_ROOT, `.${relative}`);
    // Guard against path traversal via a malformed stored URL.
    if (!resolved.startsWith(UPLOAD_ROOT + path.sep)) return;
    await unlink(resolved).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  },
};

export const storage: StorageAdapter = localDiskAdapter;

export const UPLOADS_DIR = UPLOAD_ROOT;
