/**
 * Khóa tìm không dấu, cùng quy tắc CNS `toSearchKey`:
 * "Kỹ sư Đường sắt" → "ky su duong sat".
 */
export function toSearchKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
