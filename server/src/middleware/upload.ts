import multer from 'multer';
import { AppError } from '../lib/errors.js';

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export const MAX_COVER_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

/** Buffers the upload in memory (covers are small) and rejects anything not an allow-listed image type. */
export const coverImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_COVER_IMAGE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TO_EXT[file.mimetype]) {
      cb(new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Cover images must be JPEG, PNG or WebP'));
      return;
    }
    cb(null, true);
  },
});

export function extensionForMime(mimetype: string): string {
  return ALLOWED_MIME_TO_EXT[mimetype] ?? '.jpg';
}
