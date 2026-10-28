import { ROSTER_TEMPLATE_HEADERS } from './class_management.constants';
import type { RosterRow } from './class_management.types';

const MAX_ROWS = 1000;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

export class RosterFileError extends Error {}

export function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    const rich = value as { text?: unknown; richText?: { text: string }[]; result?: unknown };
    if (Array.isArray(rich.richText)) return rich.richText.map((part) => part.text).join('').trim();
    if (rich.text !== undefined) return String(rich.text).trim();
    if (rich.result !== undefined) return String(rich.result).trim();
  }
  return String(value).trim().normalize('NFC');
}

/**
 * Đọc tệp Excel theo mẫu: dòng 1 là tiêu đề, cột A mã học sinh, cột B họ và tên.
 * Số dòng trả về trùng số dòng trong tệp để báo lỗi đúng vị trí; dòng trống bị bỏ qua.
 */
export async function parseRosterFile(file: File): Promise<RosterRow[]> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) throw new RosterFileError('Chỉ nhận tệp .xlsx theo mẫu.');
  if (file.size > MAX_FILE_BYTES) throw new RosterFileError('Tệp quá lớn (tối đa 2 MB).');

  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    throw new RosterFileError('Không đọc được tệp. Kiểm tra lại định dạng.');
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new RosterFileError('Tệp không có trang tính.');

  const header = [cellText(sheet.getCell(1, 1).value), cellText(sheet.getCell(1, 2).value)];
  if (header[0] !== ROSTER_TEMPLATE_HEADERS[0] || header[1] !== ROSTER_TEMPLATE_HEADERS[1]) {
    throw new RosterFileError('Sai mẫu: dòng đầu phải là "Mã học sinh" và "Họ và tên".');
  }

  const rows: RosterRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const student_code = cellText(row.getCell(1).value);
    const full_name = cellText(row.getCell(2).value);
    if (student_code === '' && full_name === '') return;
    rows.push({ row: rowNumber, student_code, full_name });
  });
  if (rows.length === 0) throw new RosterFileError('Tệp không có dòng học sinh nào.');
  if (rows.length > MAX_ROWS) throw new RosterFileError(`Tệp có quá ${MAX_ROWS} dòng.`);
  return rows;
}

/** Tải tệp mẫu để giáo viên điền */
export async function downloadRosterTemplate(): Promise<void> {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('Danh sách học sinh');
  sheet.addRow([...ROSTER_TEMPLATE_HEADERS]);
  sheet.getRow(1).font = { bold: true };
  sheet.columns = [{ width: 18 }, { width: 36 }];

  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'mau-danh-sach-hoc-sinh.xlsx';
  link.click();
  URL.revokeObjectURL(url);
}
