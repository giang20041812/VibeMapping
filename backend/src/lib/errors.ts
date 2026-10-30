import type { PostgrestError } from '@supabase/supabase-js';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

type DbError = Pick<PostgrestError, 'code' | 'message'>;

/** Đổi lỗi của PostgREST / hàm RPC sang HttpError; hàm RPC dùng `raise exception 'forbidden'` v.v. */
export function fromDbError(error: DbError): HttpError {
  const message = error.message ?? '';
  if (error.code === '23505') return new HttpError(409, 'duplicate');
  if (error.code === '23503') return new HttpError(409, 'reference_violation');
  if (error.code === '42501' || message.includes('forbidden')) return new HttpError(403, 'forbidden');
  if (error.code === 'PGRST116' || message.includes('not_found')) return new HttpError(404, 'not_found');
  if (error.code === 'PGRST301' || error.code === '28000') return new HttpError(401, 'unauthorized');
  if (error.code === 'P0001' || error.code?.startsWith('22') || error.code === '23502' || error.code === '23514') {
    return new HttpError(400, 'invalid_request', message);
  }
  console.error('Lỗi truy vấn Supabase:', error.code, message);
  return new HttpError(500, 'database_error');
}

/** Ném lỗi nếu truy vấn Supabase thất bại, ngược lại trả dữ liệu */
export function unwrap<T>(result: { data: T; error: DbError | null }): T {
  if (result.error) throw fromDbError(result.error);
  return result.data;
}

/** Như unwrap, cho truy vấn danh sách: không có dòng nào thì trả mảng rỗng */
export function unwrapRows<T>(result: { data: T[] | null; error: DbError | null }): T[] {
  return unwrap(result) ?? [];
}
