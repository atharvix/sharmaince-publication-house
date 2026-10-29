import multer from 'multer';
import { AppError } from '../lib/errors.js';

// Generous so a straight-off-the-phone photo works; covers are re-encoded to ~200KB before storage.
export const MAX_COVER_IMAGE_BYTES = 15 * 1024 * 1024; // 15MB

/** Buffers the upload in memory; the content is checked in `detectImageExtension`. */
export const coverImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_COVER_IMAGE_BYTES, files: 1 },
});

/**
 * Identifies JPEG/PNG/WebP from the file's leading bytes. The client-supplied MIME type
 * and filename are ignored — they're trivially spoofed.
 */
export function detectImageExtension(buffer: Buffer): '.jpg' | '.png' | '.webp' {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return '.jpg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return '.png';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return '.webp';
  throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Cover images must be JPEG, PNG or WebP');
}
