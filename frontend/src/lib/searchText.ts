/** Chuẩn hóa để so khớp tìm kiếm: bỏ dấu tiếng Việt, đ thành d, chữ thường */
export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim();
}
