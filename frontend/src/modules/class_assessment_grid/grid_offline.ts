import type { CellValue } from './class_assessment_grid.types';

/** Thay đổi chưa lưu được lên máy chủ (mất mạng), giữ ở Local Storage theo từng bảng điểm */
export interface PendingChange {
  gridStudentId: string;
  criteriaId: string;
  value: CellValue;
}

const keyOf = (gridId: string) => `vm_grid_pending_${gridId}`;

export function loadPending(gridId: string): PendingChange[] {
  try {
    const raw = window.localStorage.getItem(keyOf(gridId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as PendingChange[]) : [];
  } catch {
    return [];
  }
}

/** Gộp thay đổi mới vào hàng đợi; cùng một ô thì giữ giá trị sau cùng */
export function addPending(gridId: string, changes: PendingChange[]): void {
  const merged = new Map<string, PendingChange>();
  for (const item of [...loadPending(gridId), ...changes]) merged.set(`${item.gridStudentId}|${item.criteriaId}`, item);
  try {
    window.localStorage.setItem(keyOf(gridId), JSON.stringify([...merged.values()]));
  } catch {
    // Local Storage bị tắt: bỏ qua, điểm vẫn nằm trên màn hình
  }
}

/** Ô vừa lưu được lên máy chủ thì bỏ khỏi hàng đợi, tránh giá trị cũ ghi đè giá trị mới khi đồng bộ */
export function removePending(gridId: string, changes: PendingChange[]): void {
  const done = new Set(changes.map((item) => `${item.gridStudentId}|${item.criteriaId}`));
  const rest = loadPending(gridId).filter((item) => !done.has(`${item.gridStudentId}|${item.criteriaId}`));
  try {
    if (rest.length === 0) window.localStorage.removeItem(keyOf(gridId));
    else window.localStorage.setItem(keyOf(gridId), JSON.stringify(rest));
  } catch {
    // bỏ qua
  }
}

export function clearPending(gridId: string): void {
  try {
    window.localStorage.removeItem(keyOf(gridId));
  } catch {
    // bỏ qua
  }
}

/** Lỗi do mất kết nối (khác lỗi bị từ chối như hết quyền hoặc bảng đã khóa) */
export function isNetworkFailure(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const message = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : '';
  return /failed to fetch|networkerror|network request failed|load failed/i.test(message);
}
