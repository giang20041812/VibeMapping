import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * Client không gắn kiểu cho bảng/cột Phase 3 chưa có trong types/supabase.ts.
 * Sinh lại type bằng `npm run supabase:types` sau khi áp migration rồi chuyển về client có kiểu.
 */
export const db = supabase as unknown as SupabaseClient;

/** Gọi RPC chưa có trong file type sinh tự động. Lỗi Supabase được ném ra cho màn hình xử lý. */
export async function callRpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(name, args);
  if (error) throw error;
  return data as T;
}
