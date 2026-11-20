import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { MulterError } from 'multer';
import { AppError } from '../lib/errors.js';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` } });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    const details = err.details instanceof ZodError ? err.details.flatten() : err.details;
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details } });
  }

  // express.json()/express.raw() reject malformed or oversized bodies with an error that
  // carries an HTTP status — surface that instead of a generic 500.
  if (typeof err === 'object' && err !== null && 'type' in err && 'status' in err && typeof err.status === 'number') {
    const message = err.type === 'entity.too.large' ? 'The request body is too large' : 'The request body is not valid JSON';
    return res.status(err.status).json({ error: { code: 'BAD_REQUEST', message } });
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
    if (err.code === 'P2003') {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'A referenced record does not exist' } });
    }
  }

  // pino-http attaches the request-scoped logger, so this line carries the request id.
  req.log.error({ err }, 'unhandled error');
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } });
}
