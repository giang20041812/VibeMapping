/**
 * Kho tệp riêng tư (INT-005): lưu PDF và tệp dữ liệu đã xuất vào bucket "exports" của Supabase Storage,
 * thư mục <user_id>/<loại>/. Tải lại bằng đường dẫn có hạn. Kho chưa sẵn sàng thì chỉ tải về máy, không báo lỗi chặn.
 */
import { db } from './rpc';
import { supabase } from './supabase';

export const EXPORT_BUCKET = 'exports';
const SIGNED_URL_SECONDS = 600;

export type ExportKind = 'orientation_profile' | 'decision_report' | 'personal_data';

export const EXPORT_KIND_LABEL: Record<ExportKind, string> = {
  orientation_profile: 'Hồ sơ định hướng',
  decision_report: 'Báo cáo quyết định',
  personal_data: 'Dữ liệu cá nhân',
};

export interface ExportedFile {
  id: string;
  kind: ExportKind;
  title: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

/** Tên tệp an toàn cho đường dẫn kho: bỏ dấu, chữ thường, chỉ giữ a-z 0-9 . - */
function safeName(fileName: string): string {
  return fileName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'tep';
}

/** Lưu tệp vào kho; trả về bản ghi hoặc null khi kho chưa sẵn sàng hay không có quyền */
export async function saveExport(kind: ExportKind, title: string, fileName: string, blob: Blob): Promise<ExportedFile | null> {
  const { data: auth } = await supabase.auth.getUser();
  const ownerId = auth.user?.id;
  if (!ownerId || blob.size === 0) return null;
  const path = `${ownerId}/${kind}/${Date.now()}-${safeName(fileName)}`;
  const { error: uploadError } = await supabase.storage.from(EXPORT_BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
  if (uploadError) {
    console.error('Lỗi lưu tệp vào kho:', uploadError.message);
    return null;
  }
  const { data, error } = await db
    .from('exported_files')
    .insert({ owner_id: ownerId, kind, title, file_name: fileName, storage_path: path, mime_type: blob.type, size_bytes: blob.size })
    .select('id, kind, title, file_name, storage_path, mime_type, size_bytes, created_at')
    .single();
  if (error) {
    console.error('Lỗi ghi danh sách tệp:', error.message);
    await supabase.storage.from(EXPORT_BUCKET).remove([path]);
    return null;
  }
  return data as ExportedFile;
}

export async function listExports(): Promise<ExportedFile[]> {
  const { data, error } = await db
    .from('exported_files')
    .select('id, kind, title, file_name, storage_path, mime_type, size_bytes, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as ExportedFile[];
}

/** Đường dẫn tải có hạn 10 phút, tải về đúng tên tệp gốc */
export async function exportDownloadUrl(file: ExportedFile): Promise<string> {
  const { data, error } = await supabase.storage.from(EXPORT_BUCKET).createSignedUrl(file.storage_path, SIGNED_URL_SECONDS, { download: file.file_name });
  if (error || !data?.signedUrl) throw error ?? new Error('signed_url_failed');
  return data.signedUrl;
}

export async function deleteExport(file: ExportedFile): Promise<void> {
  const { error: storageError } = await supabase.storage.from(EXPORT_BUCKET).remove([file.storage_path]);
  if (storageError) console.error('Lỗi xóa tệp trong kho:', storageError.message);
  const { error } = await db.from('exported_files').delete().eq('id', file.id);
  if (error) throw error;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MB`;
}
