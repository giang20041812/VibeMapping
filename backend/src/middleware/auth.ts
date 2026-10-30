import type { Request, RequestHandler } from 'express';
import { HttpError } from '../lib/errors.js';
import { createUserClient, verifyAccessToken } from '../lib/supabase.js';

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization ?? '';
  const accessToken = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!accessToken) throw new HttpError(401, 'unauthorized');

  const user = await verifyAccessToken(accessToken);
  if (!user) throw new HttpError(401, 'unauthorized');

  req.auth = { userId: user.id, email: user.email ?? null, accessToken, db: createUserClient(accessToken) };
  next();
};

/** Lấy thông tin người gọi trong handler đã đi qua requireAuth */
export function getAuth(req: Request): NonNullable<Request['auth']> {
  if (!req.auth) throw new HttpError(401, 'unauthorized');
  return req.auth;
}
