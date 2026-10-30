import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import type { Database } from '../types/supabase.js';
import { HttpError } from './errors.js';

export type Db = SupabaseClient<Database>;

const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

/** Client chạy với JWT của người gọi: RLS và kiểm quyền trong hàm RPC vẫn áp dụng như khi gọi từ frontend */
export function createUserClient(accessToken: string): Db {
  return createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: authOptions,
  });
}

let adminClient: Db | null = null;

/** Client service role, bỏ qua RLS: chỉ dùng sau khi đã kiểm quyền người gọi */
export function getAdminClient(): Db {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new HttpError(500, 'server_not_configured');
  adminClient ??= createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: authOptions });
  return adminClient;
}

const anonClient = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: authOptions });

/** Xác minh access token với Supabase Auth và trả về người dùng; null nếu token sai/hết hạn */
export async function verifyAccessToken(accessToken: string) {
  const { data, error } = await anonClient.auth.getUser(accessToken);
  // Không gọi được Supabase Auth khác với token sai: báo 503 để frontend không đẩy người dùng ra màn đăng nhập
  if (error && (error.name === 'AuthRetryableFetchError' || (error.status ?? 0) >= 500)) throw new HttpError(503, 'auth_unavailable');
  return error ? null : data.user;
}
