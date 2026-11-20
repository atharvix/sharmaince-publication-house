import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import * as z from 'zod/v4';
import sharp from 'sharp';
import { env } from '../env.js';
import { logger } from './logger.js';

/** A printed front cover is roughly 7:10; anything much wider is a wraparound (back + spine + front). */
const FRONT_COVER_RATIO = 0.7;
const WRAPAROUND_MIN_RATIO = 1.15;
const MAX_COVER_HEIGHT = 1600;

const coverDetailsSchema = z.object({
  title: z.string().describe('Main title exactly as printed, without the subtitle'),
  subtitle: z.string().nullable().describe('Subtitle or tag line under the title, e.g. "As per the revised INC syllabus"'),
  authors: z
    .array(
      z.object({
        name: z.string().describe('Name as printed, with honorifics such as Dr. kept'),
        credentials: z.string().nullable().describe('Degrees and current role, one short line, if the cover gives them'),
        bio: z.string().nullable().describe('The author bio from the back cover, cleaned up, if there is one'),
      }),
    )
    .describe('Every author in the order printed'),
  isbn: z.string().nullable().describe('Only a real ISBN with all digits printed; null if missing or a placeholder like 978-93-XXXX'),
  edition: z.string().nullable().describe('Edition if printed, e.g. "2nd edition"'),
  description: z.string().describe('Two or three sentences for a bookshop listing, based only on what the cover says'),
  highlights: z.array(z.string()).describe('Up to five short selling points printed on the cover, if any'),
  subjectSlug: z.string().nullable().describe('The best matching slug from the subject list, or null if none fits'),
  frontCover: z
    .object({ left: z.number(), right: z.number() })
    .nullable()
    .describe('If the image shows more than the front cover (spine, back cover), the front cover\'s horizontal bounds as fractions 0-1 of image width; otherwise null'),
});

export type CoverDetails = z.infer<typeof coverDetailsSchema>;

const client = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null;
export const isCoverReadingEnabled = client !== null;

/**
 * Asks Claude to read a cover photo. Returns null when no API key is configured or the
 * read fails: staff can always fill the form by hand, so this never blocks an upload.
 */
export async function readCoverDetails(image: Buffer, subjects: { slug: string; name: string }[]): Promise<CoverDetails | null> {
  if (!client) return null;
  // Claude sees images at about 1.5 megapixels; sending more only costs upload time.
  const preview = await sharp(image).rotate().resize({ width: 1568, height: 1568, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();

  try {
    const response = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: zodOutputFormat(coverDetailsSchema) },
      system:
        'You read photographed or scanned book covers for a publisher\'s catalogue. Transcribe what is printed; never invent facts such as an ISBN, edition or credentials that the cover does not show.',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: preview.toString('base64') } },
            { type: 'text', text: `Subjects in the catalogue:\n${subjects.map((s) => `${s.slug}: ${s.name}`).join('\n')}` },
          ],
        },
      ],
    });
    if (response.stop_reason === 'refusal' || !response.parsed_output) {
      logger.warn({ stopReason: response.stop_reason }, 'cover read returned no details');
      return null;
    }
    return response.parsed_output;
  } catch (error) {
    logger.error({ err: error }, 'cover read failed');
    return null;
  }
}

/**
 * Turns whatever staff upload into a clean front-cover image: applies the phone's
 * rotation, crops the front panel out of a wraparound, drops camera metadata (GPS
 * included) and re-encodes to a web-sized JPEG.
 */
export async function prepareCoverImage(image: Buffer, frontCover?: CoverDetails['frontCover']): Promise<Buffer> {
  const rotated = await sharp(image).rotate().toBuffer({ resolveWithObject: true });
  const { width, height } = rotated.info;

  let crop: { left: number; width: number } | null = null;
  if (frontCover && frontCover.right - frontCover.left >= 0.25 && frontCover.left >= 0 && frontCover.right <= 1) {
    crop = { left: Math.round(frontCover.left * width), width: Math.round((frontCover.right - frontCover.left) * width) };
  } else if (width / height >= WRAPAROUND_MIN_RATIO) {
    // The front panel sits on the right of a wraparound in left-to-right scripts.
    const frontWidth = Math.min(Math.round(height * FRONT_COVER_RATIO), width);
    crop = { left: width - frontWidth, width: frontWidth };
  }

  let pipeline = sharp(rotated.data);
  if (crop) pipeline = pipeline.extract({ left: crop.left, top: 0, width: Math.min(crop.width, width - crop.left), height });
  return pipeline.flatten({ background: '#ffffff' }).resize({ height: MAX_COVER_HEIGHT, withoutEnlargement: true }).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
}
