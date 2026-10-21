import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { MulterError } from 'multer';
import { AppError } from '../lib/errors.js';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` } });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    const details = err.details instanceof ZodError ? err.details.flatten() : err.details;
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details } });
  }

  // express.json()/express.raw() reject malformed bodies with a SyntaxError that
  // carries an HTTP status (usually 400) — surface that instead of a generic 500.
  if (err instanceof SyntaxError && 'status' in err && typeof (err as { status?: unknown }).status === 'number') {
    const status = (err as { status: number }).status;
    return res.status(status).json({ error: { code: 'BAD_REQUEST', message: 'The request body is not valid JSON' } });
  }

  if (err instanceof MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'The uploaded file is too large' : 'Could not process the uploaded file';
    return res.status(400).json({ error: { code: 'UPLOAD_ERROR', message } });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'A record with these details already exists' } });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resource not found' } });
    }
  }

  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } });
}
