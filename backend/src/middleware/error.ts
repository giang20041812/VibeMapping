import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../lib/errors.js';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'not_found' });
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.code, message: error.message !== error.code ? error.message : undefined });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({ error: 'invalid_request', issues: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })) });
    return;
  }
  if (error?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'invalid_json' });
    return;
  }
  if (error?.type === 'entity.too.large') {
    res.status(413).json({ error: 'payload_too_large' });
    return;
  }
  console.error('Lỗi không xác định:', error);
  res.status(500).json({ error: 'internal_error' });
};
