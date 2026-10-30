import type { Db } from '../lib/supabase.js';

declare global {
  namespace Express {
    interface Request {
      /** Có sau middleware requireAuth */
      auth?: {
        userId: string;
        email: string | null;
        accessToken: string;
        /** Client Supabase chạy bằng quyền của người gọi */
        db: Db;
      };
    }
  }
}

export {};
